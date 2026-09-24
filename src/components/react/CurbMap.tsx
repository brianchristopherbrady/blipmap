import { createComponent } from "@lit/react";
import React from "react";
import { CurbMap as CurbMapElement } from "../web/curb-map";

export type { CurbMap as CurbMapElement } from "../web/curb-map";

export const CurbMap = createComponent({
  tagName: "curb-map",
  elementClass: CurbMapElement,
  react: React,
  events: {
    onMapClick:      "curb-map-click",
    onMapReady:      "curb-map-ready",
    onRecordSelect:  "curb-record-select",
    onMeasureChange: "curb-measure-change",
    onPathComplete:  "curb-path-complete",
    onMapCenter:     "curb-map-center",
    onLocateError:   "curb-locate-error",
    onGroupChange:   "curb-group-change",
  },
});
