"use client";
import { createContext, useContext } from "react";

// Screens outside the retained bottom tabs are active by default.
export const ScreenActivity = createContext(true);
export const useScreenActive = () => useContext(ScreenActivity);
