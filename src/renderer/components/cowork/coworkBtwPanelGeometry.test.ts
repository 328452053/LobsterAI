import { describe, expect, test } from 'vitest';

import {
  clampCoworkBtwPanelGeometry,
  COWORK_BTW_PANEL_DEFAULT_HEIGHT,
  COWORK_BTW_PANEL_DEFAULT_WIDTH,
  COWORK_BTW_PANEL_MARGIN,
  getInitialCoworkBtwPanelGeometry,
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
});

