/**
 * Show data stubs.
 *
 * TODO(FIR-58): replace these with real Supabase-backed records once the
 * backend timeline/shopping-list schemas are wired up.
 */

import type { ShoppingItem } from "@/app/components/app/ShoppingListTable";
import type { ShowGuideStep } from "@/app/components/app/ShowGuideList";

export type ShowStatus = "complete" | "draft";

export type Show = {
  id: string;
  title: string;
  song: string;
  artist: string;
  status: ShowStatus;
  duration: string;
  budgetCents: number;
  totalCents: number;
  effects: number;
  syncPercent: number;
  safetyMeters: number;
  lastEdited: string;
  shopping: ShoppingItem[];
  guide: ShowGuideStep[];
};

export const SHOWS: Show[] = [
  {
    id: "midnight-galaxy",
    title: "Midnight Galaxy",
    song: "Outro",
    artist: "M83",
    status: "complete",
    duration: "04:12",
    budgetCents: 450000,
    totalCents: 124000,
    effects: 142,
    syncPercent: 98.4,
    safetyMeters: 40,
    lastEdited: "Oct 24, 2023",
    shopping: [
      { name: "Gold Comet Tail (5\" shell)", qty: 24, price: 12.5 },
      { name: "Silver Willow Crackle (4\" shell)", qty: 16, price: 18.0 },
      { name: "Red Peony Burst Cake (500g)", qty: 8, price: 42.0 },
      { name: "Blue Strobe Mortar Rack (12-shot)", qty: 4, price: 88.0 },
      { name: "Finale Multi-Cake (1.4G)", qty: 1, price: 220.0 },
    ],
    guide: [
      {
        time: "0:00",
        description:
          "Pre-show: confirm 40m clearance, mortars secured upright, audio cue verified.",
      },
      {
        time: "0:08",
        description:
          "Opening volley — 8x Gold Comet Tail on the first downbeat, fired in a slow-arc sweep left to right.",
      },
      {
        time: "1:42",
        description:
          "Build into the bridge with paired Silver Willow Crackle every 4 bars; let the crackle linger before the snare hit.",
      },
      {
        time: "3:18",
        description:
          "Hold blue strobe rack for 12 seconds — the camera-front centerpiece while the strings swell.",
      },
      {
        time: "3:52",
        description:
          "Trigger the finale multi-cake on the final crescendo. Cease all manual cues once it ignites.",
      },
    ],
  },
  {
    id: "summer-solstice",
    title: "Summer Solstice",
    song: "Summer (Presto)",
    artist: "Vivaldi",
    status: "draft",
    duration: "09:45",
    budgetCents: 1220000,
    totalCents: 980000,
    effects: 286,
    syncPercent: 96.8,
    safetyMeters: 60,
    lastEdited: "Nov 02, 2023",
    shopping: [
      { name: "Gold Brocade Crown (6\" shell)", qty: 32, price: 32.0 },
      { name: "Red & White Peony (5\" shell)", qty: 24, price: 14.0 },
      { name: "Silver Strobe Cake (500g)", qty: 12, price: 60.0 },
    ],
    guide: [
      {
        time: "0:00",
        description: "Hold for 12 bars of strings before the first cue.",
      },
      {
        time: "1:30",
        description:
          "Begin paired Gold Brocade Crown shells in time with the violin staccato.",
      },
      {
        time: "9:00",
        description:
          "Final 45 seconds: empty the silver strobe cakes back to back into the finale.",
      },
    ],
  },
  {
    id: "neon-horizon",
    title: "Neon Horizon",
    song: "Los Angeles",
    artist: "The Midnight",
    status: "complete",
    duration: "05:20",
    budgetCents: 680000,
    totalCents: 612000,
    effects: 178,
    syncPercent: 97.6,
    safetyMeters: 45,
    lastEdited: "Oct 15, 2023",
    shopping: [
      { name: "Magenta Peony (5\" shell)", qty: 18, price: 16.5 },
      { name: "Cyan Strobe Mortar (4\" shell)", qty: 12, price: 14.0 },
      { name: "Gold Glitter Tail Cake (500g)", qty: 6, price: 55.0 },
    ],
    guide: [
      {
        time: "0:00",
        description:
          "Opening synth pad: hold gold glitter tails for the first 30 seconds.",
      },
      {
        time: "2:10",
        description:
          "Magenta + cyan paired peonies on every other downbeat through the chorus.",
      },
      {
        time: "5:00",
        description:
          "Reserve the final 20 seconds of cyan strobes for the outro fade.",
      },
    ],
  },
];

export function getShow(id: string): Show | undefined {
  return SHOWS.find((show) => show.id === id);
}
