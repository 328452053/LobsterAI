import { describe, expect, test } from 'vitest';

import {
  clampCoworkBtwPanelGeometry,
  COWORK_BTW_PANEL_DEFAULT_HEIGHT,
  COWORK_BTW_PANEL_DEFAULT_WIDTH,
  COWORK_BTW_PANEL_MARGIN,
  CoworkBtwResizeDirection,
  getInitialCoworkBtwPanelGeometry,
  resizeCoworkBtwPanelGeometry,
} from './coworkBtwPanelGeometry';

describe('coworkBtwPanelGeometry', () => {
  test('places the default rectangle in the application bottom-right corner', () => {
    expect(getInitialCoworkBtwPanelGeometry({
      width: 1440,
      height: 900,
    })).toEqual({
      x: 1440 - COWORK_BTW_PANEL_DEFAULT_WIDTH - COWORK_BTW_PANEL_MARGIN,
      y: 900 - COWORK_BTW_PANEL_DEFAULT_HEIGHT - COWORK_BTW_PANEL_MARGIN,
      width: COWORK_BTW_PANEL_DEFAULT_WIDTH,
      height: COWORK_BTW_PANEL_DEFAULT_HEIGHT,
    });
  });

  test('keeps dragged and resized geometry inside small application viewports', () => {
    expect(clampCoworkBtwPanelGeometry({
      x: -500,
      y: 900,
      width: 800,
      height: 900,
    }, {
      width: 360,
      height: 480,
    })).toEqual({
      x: COWORK_BTW_PANEL_MARGIN,
      y: COWORK_BTW_PANEL_MARGIN,
      width: 328,
      height: 448,
    });
  });

  test('resizes independently from all four edges and all four corners', () => {
    const geometry = {
      x: 200,
      y: 160,
      width: 440,
      height: 400,
    };
    const viewport = {
      width: 1200,
      height: 900,
    };

    expect(resizeCoworkBtwPanelGeometry(
      geometry,
      40,
      30,
      CoworkBtwResizeDirection.Top,
      viewport,
    )).toEqual({ x: 200, y: 190, width: 440, height: 370 });
    expect(resizeCoworkBtwPanelGeometry(
      geometry,
      40,
      30,
      CoworkBtwResizeDirection.TopRight,
      viewport,
    )).toEqual({ x: 200, y: 190, width: 480, height: 370 });
    expect(resizeCoworkBtwPanelGeometry(
      geometry,
      40,
      30,
      CoworkBtwResizeDirection.Right,
      viewport,
    )).toEqual({ x: 200, y: 160, width: 480, height: 400 });
    expect(resizeCoworkBtwPanelGeometry(
      geometry,
      40,
      30,
      CoworkBtwResizeDirection.BottomRight,
      viewport,
    )).toEqual({ x: 200, y: 160, width: 480, height: 430 });
    expect(resizeCoworkBtwPanelGeometry(
      geometry,
      40,
      30,
      CoworkBtwResizeDirection.Bottom,
      viewport,
    )).toEqual({ x: 200, y: 160, width: 440, height: 430 });
    expect(resizeCoworkBtwPanelGeometry(
      geometry,
      40,
      30,
      CoworkBtwResizeDirection.BottomLeft,
      viewport,
    )).toEqual({ x: 240, y: 160, width: 400, height: 430 });
    expect(resizeCoworkBtwPanelGeometry(
      geometry,
      40,
      30,
      CoworkBtwResizeDirection.Left,
      viewport,
    )).toEqual({ x: 240, y: 160, width: 400, height: 400 });
    expect(resizeCoworkBtwPanelGeometry(
      geometry,
      40,
      30,
      CoworkBtwResizeDirection.TopLeft,
      viewport,
    )).toEqual({ x: 240, y: 190, width: 400, height: 370 });
  });

  test('keeps edge and corner resizing within minimum size and viewport margins', () => {
    const viewport = {
      width: 800,
      height: 700,
    };
    expect(resizeCoworkBtwPanelGeometry(
      { x: 200, y: 160, width: 440, height: 400 },
      1_000,
      1_000,
      CoworkBtwResizeDirection.TopLeft,
      viewport,
    )).toEqual({
      x: 320,
      y: 240,
      width: 320,
      height: 320,
    });
    expect(resizeCoworkBtwPanelGeometry(
      { x: 200, y: 160, width: 440, height: 400 },
      1_000,
      1_000,
      CoworkBtwResizeDirection.BottomRight,
      viewport,
    )).toEqual({
      x: 200,
      y: 160,
      width: 584,
      height: 524,
    });
  });
});
