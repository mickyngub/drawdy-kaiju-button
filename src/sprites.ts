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

// Drawdy shows this through <img>, where currentColor is black, so the art is a full-colour PNG.
export const ACTION_BUTTON_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="18" height="18"><image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAMAAADVRocKAAABgFBMVEX+TE206/wCF07/TU39/f4AC0S79P7C+/7+UE1Kt/wAAjoLJVkUNWoipPMpSHYhnOoxJFDQRE2QN05OKU9rmLhHaJCk2u00WYaGuNL/TU16qcetPU51MU9Pwv4PLGEQSYZNc5r/TU1niquWyuJbhaiRxNz/TU0UVZQbh9FUfKL/TU01Un0iO2oemeYBAgK8QE6uuMmd0+g6Y4//TU00isvm6u5md5iGlK9mLk8RQn0laKZHW4NCp+wUaKyYpbz/TU0nHk0sd7bU2uM5ltjEy9bN09y8xtQYesLd4+l/sMyIi48dkd0mJyoTFhhzoL1mZ2pxgJ4Wc7mwtLehrcGmqKxOUFOYmpwRXqEuf8Fyd3tGV38AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABDZZDVAAAAgHRSTlP+//8A////////////////////////////Lv////////+5/////47////O//////////9v//////////////9D////////////////////////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOs4sEAAAAp1SURBVHjavVoJexo5EqU1lhpLog30CYYGc9jGYDu+4itO7Dj3JHPPXv//h2yV+qYvsrO7+r7EYEM9qerpVanUjR/yo3exf9T47nG0f9ErMNbIWf9PjCcgvRqAN3uNvzj23lQA9DYw32zCfx0Y0es8RK8MYH8D453uTbtN1Gi3b7qdRhHGfjFA3fSbjd0btE3jgSiDIoy9AoBerfluG40TYbjj2WQyW9iGxPfE3C2A6K0D9OrMD3DuxJh5DmN6MJg2tVwBGO3dcoTGZva7OPnVZMp0xrRkwFvHMgDCzC+ilwGomb4J9o2+pqeNxxhaf0XJY6cZTqXdCb+WBqiMb3MXzPsWWCoZujYRhHQD2sKLZjrSCuCi1j22VmoeEdhY8RbCDZOJA3IRAVQGoInR7VeZ15jlh9wlQLR2c/cxxOiFAHvV9qmc60FA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" x="1" y="1" width="22" height="22"/></svg>`;
