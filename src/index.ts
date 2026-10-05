import type {
    DomElementSchema,
    DriverCommandIssuer,
    DriverModule,
    ProtocolCommandError,
    SubscribeableKey,
} from "@drawdy/driver-protocol";
import {
    advance,
    applyStomp,
    createMotionState,
    monsterFrameAt,
    pickTargets,
    planRampage,
    transformsOf,
    MONSTER_FRAME_MS,
    TICK_MS,
    TOTAL_MS,
    WALK_MS,
    type MotionState,
    type RampagePlan,
    type Rect,
    type Stomp,
} from "./rampage";
import { rectToScreen, type Point, type ScreenMapping } from "./screen";
import {
    ACTION_BUTTON_SVG,
    ALL_SPRITES,
    FOOTPRINT_ASPECT,
    FOOTPRINT_SPRITE,
    MONSTER_SPRITES,
} from "./sprites";

const LOG = "[mickyngub.kaiju-button]";
const BUTTON_RETRIES_MS = [800, 2000, 4000, 8000, 15000];
const GEOMETRY_PROPERTIES: SubscribeableKey[] = [
    "type",
    "x",
    "y",
    "width",
    "height",
];
const MAX_TRANSFORMS_IN_FLIGHT = 2;
const WARMUP_MS = 240;
const WARMUP_POSITION: Point = { x: -10000, y: -10000 };
const WARMUP_SIZE = 4;
const CAMERA_RUMBLE = true;
const RUMBLE_FRACTION = 0.005;
const RUMBLE_STEP_MS = 60;
const RUMBLE_FLY_MS = 55;

let issue: DriverCommandIssuer;
let driverId: string;
let seq = 0;

const stamp = () => ({ driverId, requestId: String(seq++) });

const unwrap = <V>(response: {
    res: { error?: ProtocolCommandError; value?: V };
}): V => {
    const { error } = response.res;
    if (error !== undefined) {
        throw new Error(error.message ?? error.type);
    }
    return response.res.value as V;
};

type Sprite = { url: string; rect: Rect };

type Run = {
    plan: RampagePlan;
    motions: MotionState;
    prefix: string;
    mapping: ScreenMapping;
    zoom: number;
    refreshing: boolean;
    refreshDirty: boolean;
    sprites: Map<string, Sprite>;
    raiseMonster: boolean;
    startedAt: number;
    lastTickAt: number;
    lastMonsterAt: number;
    stompCursor: number;
    tick: ReturnType<typeof setInterval> | null;
    timers: ReturnType<typeof setTimeout>[];
    monsterInFlight: boolean;
    transformsInFlight: number;
};

let run: Run | null = null;
let busy = false;
let pendingAbort = false;
const liveSprites = new Set<string>();
let previewOpen = false;
let runNo = 0;

const buttonId = (): string => `${driverId}.rampage-button`;

const monsterId = (active: Run): string => `${active.prefix}.monster`;

const spriteSchema = (
    url: string,
    width: number,
    height: number
): DomElementSchema => ({
    type: "box",
    styles: {
        width: [width, "px"],
        height: [height, "px"],
        overflow: "visible",
        pointerEvents: "none",
    },
    children: [
        {
            type: "image",
            child: url,
            styles: {
                width: [width, "px"],
                height: [height, "px"],
                pointerEvents: "none",
            },
        },
    ],
});

const placement = (
    active: Run,
    sprite: Sprite
): { position: Point; schema: DomElementSchema } => {
    const { x, y, width, height } = rectToScreen(active.mapping, sprite.rect);
    return {
        position: { x, y },
        schema: spriteSchema(sprite.url, width, height),
    };
};

const readMapping = async (
    reference: Point,
    zoom: number
): Promise<ScreenMapping> => {
    const screen = unwrap(
        await issue({
            type: "command:camera:canvas-to-screen",
            ...stamp(),
            req: { x: reference.x, y: reference.y },
        })
    );
    return {
        cx: reference.x,
        cy: reference.y,
        sx: screen.x,
        sy: screen.y,
        zoom,
    };
};

const createSprite = async (
    domId: string,
    position: Point,
    schema: DomElementSchema
): Promise<void> => {
    unwrap(
        await issue({
            type: "command:dom:create-floating-element",
            ...stamp(),
            req: { domId, position, schema },
        })
    );
    liveSprites.add(domId);
};

const removeSprite = (domId: string): void => {
    liveSprites.delete(domId);
    void issue({
        type: "command:dom:remove-floating-element",
        ...stamp(),
        req: { domId },
    }).catch(() => undefined);
};

const warmSprites = async (prefix: string): Promise<void> => {
    const ids = ALL_SPRITES.map((_, i) => `${prefix}.warm.${i}`);
    for (const [i, url] of ALL_SPRITES.entries()) {
        await createSprite(
            ids[i],
            WARMUP_POSITION,
            spriteSchema(url, WARMUP_SIZE, WARMUP_SIZE)
        );
    }
    await new Promise<void>((resolve) => setTimeout(resolve, WARMUP_MS));
    for (const id of ids) removeSprite(id);
};

const teardownRun = (): void => {
    const active = run;
    run = null;
    if (!active) return;
    if (active.tick !== null) clearInterval(active.tick);
    for (const timer of active.timers) clearTimeout(timer);
};

const releaseBoard = async (): Promise<void> => {
    const ids = [...liveSprites];
    liveSprites.clear();
    await Promise.all(
        ids.map(async (domId) => {
            try {
                unwrap(
                    await issue({
                        type: "command:dom:remove-floating-element",
                        ...stamp(),
                        req: { domId },
                    })
                );
            } catch (err) {
                console.error(`${LOG} sprite cleanup failed`, err);
            }
        })
    );
    if (!previewOpen) return;
    previewOpen = false;
    try {
        unwrap(
            await issue({
                type: "command:scene:end-preview",
                ...stamp(),
                req: {},
            })
        );
    } catch (err) {
        console.error(`${LOG} end-preview failed`, err);
    }
};

const placeSprites = (active: Run): void => {
    for (const [domId, sprite] of active.sprites) {
        if (!liveSprites.has(domId)) continue;
        void issue({
            type: "command:dom:update-floating-element",
            ...stamp(),
            req: { domId, ...placement(active, sprite) },
        }).catch(() => undefined);
    }
};

const refreshMapping = (active: Run, zoom: number): void => {
    active.zoom = zoom;
    if (active.refreshing) {
        active.refreshDirty = true;
        return;
    }
    active.refreshing = true;
    void (async () => {
        do {
            active.refreshDirty = false;
            const mapping = await readMapping(
                active.plan.viewport,
                active.zoom
            );
            if (run !== active) return;
            active.mapping = mapping;
            placeSprites(active);
        } while (active.refreshDirty);
    })()
        .catch(() => undefined)
        .finally(() => {
            active.refreshing = false;
        });
};

const dropFootprint = (active: Run, stomp: Stomp): void => {
    const width = active.plan.monsterW * 0.3;
    const height = width / FOOTPRINT_ASPECT;
    const domId = `${active.prefix}.foot.${stomp.index}`;
    const sprite: Sprite = {
        url: FOOTPRINT_SPRITE,
        rect: {
            x: stomp.footX - width / 2,
            y: stomp.footY - height * 0.55,
            width,
            height,
        },
    };
    active.sprites.set(domId, sprite);
    const { position, schema } = placement(active, sprite);
    void createSprite(domId, position, schema)
        .then(() => {
            active.raiseMonster = true;
            if (run !== active) void releaseBoard();
        })
        .catch(() => undefined);
};

const rumbleCamera = (active: Run): void => {
    void (async () => {
        const { rect } = unwrap(
            await issue({
                type: "command:camera:get-viewport-rect",
                ...stamp(),
            })
        );
        const { zoom } = unwrap(
            await issue({ type: "command:camera:get-info", ...stamp() })
        );
        if (run !== active) return;
        const dx = rect.width * RUMBLE_FRACTION;
        const dy = rect.height * RUMBLE_FRACTION;
        const offsets: [number, number][] = [
            [dx, -dy],
            [-dx, dy],
            [0, 0],
        ];
        offsets.forEach(([ox, oy], i) => {
            const timer = setTimeout(() => {
                if (run !== active) return;
                void issue({
                    type: "command:camera:fly-to-rect",
                    ...stamp(),
                    req: {
                        rect: {
                            x: rect.x + ox,
                            y: rect.y + oy,
                            width: rect.width,
                            height: rect.height,
                        },
                        flyDurationMs: RUMBLE_FLY_MS,
                        zoom,
                    },
                }).catch(() => undefined);
            }, i * RUMBLE_STEP_MS);
            active.timers.push(timer);
        });
    })().catch(() => undefined);
};

const stepMonster = (active: Run, elapsed: number): void => {
    const frame = monsterFrameAt(active.plan, elapsed);
    const domId = monsterId(active);
    const sprite: Sprite = {
        url: MONSTER_SPRITES[frame.pose],
        rect: {
            x: frame.x,
            y: frame.y,
            width: frame.width,
            height: frame.height,
        },
    };
    active.sprites.set(domId, sprite);
    const raise = active.raiseMonster;
    active.raiseMonster = false;
    active.monsterInFlight = true;
    void (async () => {
        if (raise) {
            unwrap(
                await issue({
                    type: "command:dom:remove-floating-element",
                    ...stamp(),
                    req: { domId },
                })
            );
            const { position, schema } = placement(active, sprite);
            await createSprite(domId, position, schema);
        } else {
            unwrap(
                await issue({
                    type: "command:dom:upsert-floating-element",
                    ...stamp(),
                    req: { domId, ...placement(active, sprite) },
                })
            );
            liveSprites.add(domId);
        }
        if (run !== active) void releaseBoard();
    })()
        .catch(() => undefined)
        .finally(() => {
            active.monsterInFlight = false;
        });
};

const frame = (active: Run): void => {
    if (run !== active) return;
    const now = performance.now();
    const elapsed = now - active.startedAt;
    const dt = now - active.lastTickAt;
    active.lastTickAt = now;

    if (elapsed >= TOTAL_MS) {
        teardownRun();
        void releaseBoard();
        return;
    }

    const { stomps } = active.plan;
    while (
        active.stompCursor < stomps.length &&
        elapsed >= stomps[active.stompCursor].at
    ) {
        const stomp = stomps[active.stompCursor];
        active.stompCursor++;
        applyStomp(active.motions, stomp);
        dropFootprint(active, stomp);
        if (CAMERA_RUMBLE) rumbleCamera(active);
    }

    advance(active.motions, dt);

    if (
        active.motions.items.length > 0 &&
        active.transformsInFlight < MAX_TRANSFORMS_IN_FLIGHT
    ) {
        active.transformsInFlight++;
        void issue({
            type: "command:scene:preview-transforms",
            ...stamp(),
            req: { previews: transformsOf(active.motions, elapsed) },
        })
            .catch(() => undefined)
            .finally(() => {
                active.transformsInFlight = Math.max(
                    0,
                    active.transformsInFlight - 1
                );
            });
    }

    if (
        elapsed <= WALK_MS &&
        !active.monsterInFlight &&
        now - active.lastMonsterAt >= MONSTER_FRAME_MS
    ) {
        active.lastMonsterAt = now;
        stepMonster(active, elapsed);
    }
};

const beginRampage = async (): Promise<void> => {
    await releaseBoard();
    runNo++;
    const prefix = `${driverId}.r${runNo}`;

    const { rect } = unwrap(
        await issue({ type: "command:camera:get-viewport-rect", ...stamp() })
    );
    const plan = planRampage(rect);

    const { drawdyElements } = unwrap(
        await issue({
            type: "command:scene:get-drawdy-elements",
            ...stamp(),
            req: { properties: GEOMETRY_PROPERTIES },
        })
    );
    const targets = pickTargets(plan, drawdyElements);

    let began: string[] = [];
    if (targets.length > 0) {
        previewOpen = true;
        began = unwrap(
            await issue({
                type: "command:scene:begin-preview",
                ...stamp(),
                req: { drawdyElementIds: targets.map((t) => t.id) },
            })
        ).began;
    }

    const beganSet = new Set(began);
    const motions = createMotionState(
        plan,
        targets.filter((t) => beganSet.has(t.id))
    );

    await warmSprites(prefix);
    const { zoom } = unwrap(
        await issue({ type: "command:camera:get-info", ...stamp() })
    );
    const mapping = await readMapping(plan.viewport, zoom);
    if (pendingAbort) {
        await releaseBoard();
        console.info(`${LOG} rampage cancelled during startup`);
        return;
    }

    const now = performance.now();
    const active: Run = {
        plan,
        motions,
        prefix,
        mapping,
        zoom,
        refreshing: false,
        refreshDirty: false,
        sprites: new Map(),
        raiseMonster: false,
        startedAt: now,
        lastTickAt: now,
        lastMonsterAt: 0,
        stompCursor: 0,
        tick: null,
        timers: [],
        monsterInFlight: false,
        transformsInFlight: 0,
    };
    run = active;
    active.tick = setInterval(() => {
        try {
            frame(active);
        } catch (err) {
            console.error(`${LOG} tick failed`, err);
            teardownRun();
            void releaseBoard();
        }
    }, TICK_MS);
    console.info(
        `${LOG} rampage started: ${motions.items.length} element(s), ${plan.stomps.length} stomp(s)`
    );
};

const abortRampage = async (): Promise<void> => {
    teardownRun();
    await releaseBoard();
    console.info(`${LOG} rampage ended`);
};

const abandonRampage = async (): Promise<void> => {
    previewOpen = false;
    teardownRun();
    await releaseBoard();
    console.info(`${LOG} rampage abandoned: scene replaced`);
};

const withLock = async (action: () => Promise<void>): Promise<void> => {
    if (busy) {
        pendingAbort = true;
        return;
    }
    busy = true;
    pendingAbort = false;
    try {
        await action();
    } catch (err) {
        console.error(`${LOG} rampage failed`, err);
        teardownRun();
        await releaseBoard();
    } finally {
        busy = false;
    }
};

const toggleRampage = (): Promise<void> =>
    withLock(run !== null ? abortRampage : beginRampage);

const installButton = async (attempt: number): Promise<void> => {
    let created = false;
    try {
        created = unwrap(
            await issue({
                type: "command:dom:create-action-button",
                ...stamp(),
                req: { domElementId: buttonId(), svg: ACTION_BUTTON_SVG },
            })
        ).created;
        if (created) {
            unwrap(
                await issue({
                    type: "subscription:dom:element-clicked",
                    ...stamp(),
                    req: { domElementId: buttonId() },
                })
            );
            console.info(`${LOG} action button ready`);
            return;
        }
    } catch (err) {
        console.error(`${LOG} button attempt ${attempt} failed`, err);
    }
    if (attempt >= BUTTON_RETRIES_MS.length) {
        console.error(`${LOG} action button never created`);
        return;
    }
    setTimeout(() => {
        void installButton(attempt + 1);
    }, BUTTON_RETRIES_MS[attempt]);
};

export const activate: DriverModule["activate"] = async (ctx) => {
    issue = ctx.issueCommand;
    driverId = ctx.manifest.driverId;

    try {
        unwrap(
            await issue({
                type: "subscription:keyboard:control-keys",
                ...stamp(),
            })
        );
        unwrap(
            await issue({
                type: "subscription:scene:elements-replaced",
                ...stamp(),
                req: { properties: [] },
            })
        );
        unwrap(
            await issue({
                type: "subscription:camera:moved-rapid",
                ...stamp(),
            })
        );
        await installButton(0);
    } catch (err) {
        console.error(`${LOG} activation failed`, err);
    }
    console.info(`${LOG} activated (${ctx.manifest.driverVersion})`);
};

export const onEvent: DriverModule["onEvent"] = async (event) => {
    try {
        switch (event.type) {
            case "subscription:dom:element-clicked": {
                if (event.body.domElementId !== buttonId()) return;
                await toggleRampage();
                return;
            }
            case "subscription:keyboard:control-keys": {
                if (event.body.key !== "escape") return;
                if (run === null && !busy) return;
                await withLock(abortRampage);
                return;
            }
            case "subscription:scene:elements-replaced": {
                if (
                    run === null &&
                    !busy &&
                    !previewOpen &&
                    liveSprites.size === 0
                ) {
                    return;
                }
                previewOpen = false;
                await withLock(abandonRampage);
                return;
            }
            case "subscription:camera:moved-rapid": {
                if (run === null) return;
                refreshMapping(run, event.body.zoom);
                return;
            }
            default:
                return;
        }
    } catch (err) {
        console.error(`${LOG} onEvent failed`, err);
    }
};
