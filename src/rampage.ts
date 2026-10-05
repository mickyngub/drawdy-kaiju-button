import {
    MONSTER_ASPECT,
    MONSTER_FOOT_Y,
    POSE_FOOT_X,
    type MonsterPose,
} from "./sprites";

export type Rect = { x: number; y: number; width: number; height: number };

export type Target = { id: string; cx: number; cy: number };

export type Stomp = {
    index: number;
    at: number;
    footX: number;
    footY: number;
    pose: MonsterPose;
};

export type RampagePlan = {
    viewport: Rect;
    unit: number;
    monsterW: number;
    monsterH: number;
    groundY: number;
    startX: number;
    endX: number;
    exitX: number;
    exitY: number;
    stomps: Stomp[];
};

export type MonsterFrame = {
    pose: MonsterPose;
    x: number;
    y: number;
    width: number;
    height: number;
};

export type Motion = {
    id: string;
    cx: number;
    cy: number;
    restX: number;
    restY: number;
    restRot: number;
    x: number;
    y: number;
    rot: number;
    vx: number;
    vy: number;
    vrot: number;
    phaseX: number;
    phaseY: number;
    phaseRot: number;
    gain: number;
    spinBias: number;
    leanX: number;
    leanY: number;
    leanRot: number;
};

export type MotionState = {
    plan: RampagePlan;
    items: Motion[];
    spike: number;
};

export type PreviewEntry = {
    drawdyElementId: string;
    transform: { x: number; y: number; scale: number; rotation: number };
};

export const TICK_MS = 16;
export const MONSTER_FRAME_MS = 50;
export const STOMP_MS = 700;
export const STOMP_LEAD_MS = 480;
export const WALK_MS = 8200;
export const ROAR_MS = 1000;
export const TOTAL_MS = WALK_MS + ROAR_MS;
export const MAX_TARGETS = 150;

const SPRING = 42;
const DAMPING = 7;
const SPIN_SPRING = 30;
const SPIN_DAMPING = 6;
const SPIKE_HALFLIFE_MS = 240;
const MAX_SPEED = 4200;
const MAX_SPIN = 22;
const STOMP_PUSH = 420;
const FLY_MULTIPLIER = 3.1;
const SCATTER_PUSH = 62;
const SCATTER_CAP = 210;
const SHAKE_BASE = 2.4;
const SHAKE_SPIKE = 13;
const SHAKE_ROT = 0.0024;
const LEAN_PUSH = 32;
const LEAN_ROT = 0.07;
const RAMP_IN_MS = 420;

const clamp = (v: number, lo: number, hi: number): number =>
    v < lo ? lo : v > hi ? hi : v;

const hash01 = (seed: string, salt: number): number => {
    let h = (2166136261 ^ salt) >>> 0;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 1000003) / 1000003;
};

const stepIndexAt = (elapsed: number): number =>
    Math.floor((elapsed - STOMP_LEAD_MS) / STOMP_MS);

const strideAt = (elapsed: number): number => {
    const raw = (elapsed - STOMP_LEAD_MS) / STOMP_MS;
    return raw - Math.floor(raw);
};

const plantPoseFor = (step: number): MonsterPose =>
    ((step % 2) + 2) % 2 === 0 ? "plantBack" : "plantFront";

const monsterXAt = (plan: RampagePlan, elapsed: number): number =>
    plan.startX + (plan.endX - plan.startX) * clamp(elapsed / WALK_MS, 0, 1.08);

export const planRampage = (viewport: Rect): RampagePlan => {
    const monsterH = Math.max(140, viewport.height * 0.4);
    const monsterW = monsterH * MONSTER_ASPECT;
    const groundY = viewport.y + viewport.height * 0.74;
    const startX = viewport.x - monsterW * 0.85;
    const endX = viewport.x + viewport.width + monsterW * 0.85;
    const plan: RampagePlan = {
        viewport,
        unit: Math.max(0.35, viewport.height / 800),
        monsterW,
        monsterH,
        groundY,
        startX,
        endX,
        exitX: endX + monsterW * 0.5,
        exitY: groundY - monsterH * 0.4,
        stomps: [],
    };
    for (let i = 0; ; i++) {
        const at = STOMP_LEAD_MS + i * STOMP_MS;
        if (at > WALK_MS - 250) break;
        const pose = plantPoseFor(i);
        plan.stomps.push({
            index: i,
            at,
            footX: monsterXAt(plan, at) + monsterW * POSE_FOOT_X[pose],
            footY: groundY + (i % 2 === 0 ? -1 : 1) * monsterH * 0.03,
            pose,
        });
    }
    return plan;
};

export const distanceToStompPath = (
    plan: RampagePlan,
    cx: number,
    cy: number
): number => {
    const mid = (plan.startX + plan.endX) / 2;
    const half = (plan.endX - plan.startX) / 2;
    const dx = Math.max(0, Math.abs(cx - mid) - half);
    const dy = cy - plan.groundY;
    return Math.sqrt(dx * dx + dy * dy);
};

export type Geometry = {
    id: string;
    type?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
};

export const pickTargets = (
    plan: RampagePlan,
    elements: readonly Geometry[]
): Target[] => {
    const { viewport } = plan;
    const pad = Math.max(viewport.width, viewport.height) * 0.15;
    const scored: { target: Target; d: number }[] = [];
    for (const el of elements) {
        if (el.type === "frame") continue;
        if (
            el.x == null ||
            el.y == null ||
            el.width == null ||
            el.height == null
        ) {
            continue;
        }
        if (
            el.x + el.width < viewport.x - pad ||
            el.x > viewport.x + viewport.width + pad ||
            el.y + el.height < viewport.y - pad ||
            el.y > viewport.y + viewport.height + pad
        ) {
            continue;
        }
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        scored.push({
            target: { id: el.id, cx, cy },
            d: distanceToStompPath(plan, cx, cy),
        });
    }
    scored.sort((a, b) => a.d - b.d);
    return scored.slice(0, MAX_TARGETS).map((s) => s.target);
};

export const monsterFrameAt = (
    plan: RampagePlan,
    elapsed: number
): MonsterFrame => {
    const stride = strideAt(elapsed);
    const plant = plantPoseFor(stepIndexAt(elapsed));
    const pose = stride < 0.4 ? plant : "stride";
    const lift = -Math.sin(stride * Math.PI) * plan.monsterH * 0.05;
    const dip = Math.exp(-stride * 9) * plan.monsterH * 0.022;
    return {
        pose,
        x: monsterXAt(plan, elapsed),
        y: plan.groundY - plan.monsterH * MONSTER_FOOT_Y + lift + dip,
        width: plan.monsterW,
        height: plan.monsterH,
    };
};

export const createMotionState = (
    plan: RampagePlan,
    targets: Target[]
): MotionState => ({
    plan,
    spike: 0,
    items: targets.map((t) => {
        const dx = t.cx - plan.exitX;
        const dy = t.cy - plan.exitY;
        const len = Math.max(1, Math.hypot(dx, dy));
        const bias = hash01(t.id, 7) < 0.5 ? -1 : 1;
        return {
            id: t.id,
            cx: t.cx,
            cy: t.cy,
            restX: 0,
            restY: 0,
            restRot: 0,
            x: 0,
            y: 0,
            rot: 0,
            vx: 0,
            vy: 0,
            vrot: 0,
            phaseX: hash01(t.id, 1) * Math.PI * 2,
            phaseY: hash01(t.id, 2) * Math.PI * 2,
            phaseRot: hash01(t.id, 3) * Math.PI * 2,
            gain: 0.55 + hash01(t.id, 4) * 0.9,
            spinBias: bias,
            leanX: dx / len,
            leanY: dy / len - 0.35,
            leanRot: bias * LEAN_ROT * (0.6 + hash01(t.id, 5) * 0.8),
        };
    }),
});

export const applyStomp = (state: MotionState, stomp: Stomp): void => {
    const { plan } = state;
    const radius = plan.monsterH * 1.15;
    const flyRadius = radius * 0.3;
    state.spike = Math.min(
        1.9,
        state.spike + 0.85 + 0.35 * hash01(String(stomp.index), 11)
    );
    for (const m of state.items) {
        const dx = m.cx + m.restX - stomp.footX;
        const dy = m.cy + m.restY - stomp.footY;
        const dist = Math.hypot(dx, dy);
        if (dist > radius) continue;
        const falloff = 1 - dist / radius;
        const ease = falloff * falloff;
        const len = Math.max(1, dist);
        let dirX = dx / len;
        let dirY = dy / len - 0.55;
        const dirLen = Math.max(0.001, Math.hypot(dirX, dirY));
        dirX /= dirLen;
        dirY /= dirLen;
        const flying = dist < flyRadius;
        const push =
            STOMP_PUSH * plan.unit * ease * (flying ? FLY_MULTIPLIER : 1);
        m.vx += dirX * push;
        m.vy += dirY * push;
        m.vrot += m.spinBias * ease * (flying ? 11 : 3.2);
        if (flying) {
            m.restX = clamp(
                m.restX + dirX * SCATTER_PUSH * plan.unit * ease,
                -SCATTER_CAP * plan.unit,
                SCATTER_CAP * plan.unit
            );
            m.restY = clamp(
                m.restY + dirY * SCATTER_PUSH * plan.unit * ease,
                -SCATTER_CAP * plan.unit,
                SCATTER_CAP * plan.unit
            );
            m.restRot = clamp(m.restRot + m.spinBias * ease * 0.5, -1.2, 1.2);
        }
    }
};

export const advance = (state: MotionState, dtMs: number): void => {
    const dt = Math.min(48, Math.max(1, dtMs)) / 1000;
    state.spike *= Math.pow(0.5, (dt * 1000) / SPIKE_HALFLIFE_MS);
    for (const m of state.items) {
        m.vx += ((m.restX - m.x) * SPRING - m.vx * DAMPING) * dt;
        m.vy += ((m.restY - m.y) * SPRING - m.vy * DAMPING) * dt;
        m.vrot +=
            ((m.restRot - m.rot) * SPIN_SPRING - m.vrot * SPIN_DAMPING) * dt;
        m.vx = clamp(m.vx, -MAX_SPEED, MAX_SPEED);
        m.vy = clamp(m.vy, -MAX_SPEED, MAX_SPEED);
        m.vrot = clamp(m.vrot, -MAX_SPIN, MAX_SPIN);
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.rot += m.vrot * dt;
    }
};

export const shakeEnvelopeAt = (elapsed: number): number => {
    if (elapsed < RAMP_IN_MS) return elapsed / RAMP_IN_MS;
    if (elapsed <= WALK_MS) return 1;
    const roar = clamp((elapsed - WALK_MS) / ROAR_MS, 0, 1);
    return 1 + 1.1 * Math.sin(roar * Math.PI);
};

export const leanAt = (elapsed: number): number => {
    if (elapsed <= WALK_MS) return 0;
    const roar = clamp((elapsed - WALK_MS) / ROAR_MS, 0, 1);
    return Math.sin(roar * Math.PI * 0.86);
};

export const transformsOf = (
    state: MotionState,
    elapsed: number
): PreviewEntry[] => {
    const { plan } = state;
    const amp =
        (SHAKE_BASE * shakeEnvelopeAt(elapsed) + SHAKE_SPIKE * state.spike) *
        plan.unit;
    const lean = leanAt(elapsed) * LEAN_PUSH * plan.unit;
    const leanRot = leanAt(elapsed);
    return state.items.map((m) => ({
        drawdyElementId: m.id,
        transform: {
            x:
                m.x +
                Math.sin(elapsed * 0.05 + m.phaseX) * amp * m.gain +
                m.leanX * lean,
            y:
                m.y +
                Math.sin(elapsed * 0.043 + m.phaseY) * amp * m.gain * 0.8 +
                m.leanY * lean,
            scale: 1,
            rotation:
                m.rot +
                Math.sin(elapsed * 0.031 + m.phaseRot) *
                    amp *
                    SHAKE_ROT *
                    m.gain +
                m.leanRot * leanRot,
        },
    }));
};
