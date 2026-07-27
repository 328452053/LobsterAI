export interface CoworkBtwPanelGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CoworkBtwPanelViewport {
  width: number;
  height: number;
}

export const COWORK_BTW_PANEL_MARGIN = 16;
export const COWORK_BTW_PANEL_DEFAULT_WIDTH = 440;
export const COWORK_BTW_PANEL_DEFAULT_HEIGHT = 520;
export const COWORK_BTW_PANEL_MIN_WIDTH = 320;
export const COWORK_BTW_PANEL_MIN_HEIGHT = 320;

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.min(Math.max(value, minimum), maximum)
);

const getAvailableSize = (value: number): number => (
  Math.max(1, value - COWORK_BTW_PANEL_MARGIN * 2)
);

export const clampCoworkBtwPanelGeometry = (
  geometry: CoworkBtwPanelGeometry,
  viewport: CoworkBtwPanelViewport,
): CoworkBtwPanelGeometry => {
  const availableWidth = getAvailableSize(viewport.width);
  const availableHeight = getAvailableSize(viewport.height);
  const minimumWidth = Math.min(COWORK_BTW_PANEL_MIN_WIDTH, availableWidth);
  const minimumHeight = Math.min(COWORK_BTW_PANEL_MIN_HEIGHT, availableHeight);
  const width = clamp(geometry.width, minimumWidth, availableWidth);
  const height = clamp(geometry.height, minimumHeight, availableHeight);
  return {
    x: clamp(
      geometry.x,
      COWORK_BTW_PANEL_MARGIN,
      Math.max(COWORK_BTW_PANEL_MARGIN, viewport.width - width - COWORK_BTW_PANEL_MARGIN),
    ),
    y: clamp(
      geometry.y,
      COWORK_BTW_PANEL_MARGIN,
      Math.max(COWORK_BTW_PANEL_MARGIN, viewport.height - height - COWORK_BTW_PANEL_MARGIN),
    ),
    width,
    height,
  };
};

export const getInitialCoworkBtwPanelGeometry = (
  viewport: CoworkBtwPanelViewport,
): CoworkBtwPanelGeometry => clampCoworkBtwPanelGeometry({
  x: viewport.width - COWORK_BTW_PANEL_DEFAULT_WIDTH - COWORK_BTW_PANEL_MARGIN,
  y: viewport.height - COWORK_BTW_PANEL_DEFAULT_HEIGHT - COWORK_BTW_PANEL_MARGIN,
  width: COWORK_BTW_PANEL_DEFAULT_WIDTH,
  height: COWORK_BTW_PANEL_DEFAULT_HEIGHT,
}, viewport);

