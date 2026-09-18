import { createComponent } from "@lit/react";
import React from "react";
import { CurbToolButton as CurbToolButtonElement } from "../web/curb-tool-button";

export const CurbToolButton = createComponent({
  tagName: "curb-tool-button",
  elementClass: CurbToolButtonElement,
  react: React,
  events: {},
});
