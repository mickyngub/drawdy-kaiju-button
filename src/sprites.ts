import { FRAME_ASPECT, FRAME_FOOT_X, MONSTER_FRAMES } from "./sprite-data";

export type MonsterPose = "plantBack" | "stride" | "plantFront";

const PRINT = "#231f1c";

const path = (d: string, extra: string): string => `<path d="${d}" ${extra}/>`;

const encode = (svg: string): string =>
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const footprintSvg = (): string =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -4 60 50" width="60" height="50">` +
    `<g fill="${PRINT}" opacity="0.3">` +
    path(
        "M9 28 C7 19 17 15 30 15 C43 15 53 19 51 28 C49 38 41 42 30 42 C19 42 11 38 9 28 Z",
        ""
    ) +
    `<circle cx="15" cy="14" r="6.5"/>` +
    `<circle cx="30" cy="10" r="7"/>` +
    `<circle cx="45" cy="14" r="6.5"/>` +
    path("M10 10 L13 1 L19 9 Z", "") +
    path("M25 6 L29 -3 L35 6 Z", "") +
    path("M41 9 L47 1 L50 10 Z", "") +
    `</g></svg>`;

export const MONSTER_SPRITES: Record<MonsterPose, string> = MONSTER_FRAMES;

export const FOOTPRINT_SPRITE = encode(footprintSvg());

export const ALL_SPRITES = [
    MONSTER_SPRITES.plantBack,
    MONSTER_SPRITES.stride,
    MONSTER_SPRITES.plantFront,
    FOOTPRINT_SPRITE,
];

export const MONSTER_ASPECT = FRAME_ASPECT;

export const FOOTPRINT_ASPECT = 60 / 50;

export const MONSTER_FOOT_Y = 0.98;

export const POSE_FOOT_X: Record<MonsterPose, number> = FRAME_FOOT_X;

export const ACTION_BUTTON_SVG =
    `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="currentColor" class="text-white/60">` +
    `<path fill-rule="evenodd" d="M12.6 3.2c5.3 0 9.4 4 9.4 9.2 0 5.3-4.2 9.4-9.6 9.4-2.1 0-4-.6-5.6-1.7l-1.2.9c-.5.4-1.1-.2-.8-.7l.6-1.4c-.6-.7-1.1-1.5-1.4-2.3l-1.5.3c-.6.1-.9-.6-.4-1l1.3-.9c-.1-.5-.1-1-.1-1.5 0-.6.1-1.2.2-1.7L2.2 11c-.5-.3-.3-1 .3-1l1.6.1c.4-.9.9-1.7 1.6-2.4l-.8-1.3c-.3-.5.3-1.1.8-.8l1.4.8c1.5-1.4 3.4-2.2 5.5-2.2Zm-3.4 4.6a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm7.2-1.2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-3.5 7.6c-1.5 0-2.6 1.2-2.6 2.9 0 1.6 1.2 2.9 2.6 2.9s2.6-1.3 2.6-2.9c0-1.7-1.1-2.9-2.6-2.9Z"/><circle cx="9.9" cy="11.7" r="1.2"/><circle cx="16.9" cy="9.9" r="1.1"/>` +
    `<path d="M19 4.6l1.6-1.8M20.4 6.6l2-.6M17.2 3.4l.4-1.9" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" fill="none"/>` +
    `</svg>`;
