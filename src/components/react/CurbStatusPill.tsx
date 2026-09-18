import { createComponent } from "@lit/react";
import React from "react";
import { CurbStatusPill as CurbStatusPillElement } from "../web/curb-status-pill";

export const CurbStatusPill = createComponent({
  tagName: "curb-status-pill",
  elementClass: CurbStatusPillElement,
  react: React,
  events: {},
});
