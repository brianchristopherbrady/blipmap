import { createComponent } from "@lit/react";
import React from "react";
import { CurbRecordCard as CurbRecordCardElement } from "../web/curb-record-card";

export const CurbRecordCard = createComponent({
  tagName: "curb-record-card",
  elementClass: CurbRecordCardElement,
  react: React,
  events: {
    onRecordSelect: "curb-record-select",
  },
});
