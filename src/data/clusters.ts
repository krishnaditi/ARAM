/**
 * Cluster-selection taxonomy — the structure only (ids, flag tier, icons, cross-links).
 * Every piece of text lives in i18n under `cluster.*`, keyed by these ids:
 *   cluster.names.<clusterId>   cluster.desc.<clusterId>   cluster.pill.<clusterId>
 *   cluster.subs.<subId>        cluster.items.<issueId>    cluster.emotions.<emotionId>
 *
 * FLAG MODEL (unchanged from the approved v4 prototype)
 *   f: false   → ordinary item, no safeguarding action.
 *   f: 'amber' → safeguarding concern. The session CONTINUES. A SAFEGUARD_FLAG row is
 *                written with severity=amber for counsellor review within 24–48h.
 *   f: 'red'   → immediate risk. The assessment is skipped, red_emergency_flag is set,
 *                and the mandatory protocol runs.
 * Flag markers are HIDDEN from the child. The staff-view toggle (dev drawer) reveals
 * them for review only.
 */

export type FlagLevel = false | 'amber' | 'red'

export interface ClusterItem {
  id: string
  f: FlagLevel
}

export interface SubCluster {
  id: string
  emoji: string
  /**
   * Canonical item ids borrowed from another sub-cluster. Borrowed items render
   * identically for the child but are never re-counted: one canonical id = one row.
   */
  xref?: string[]
  issues: ClusterItem[]
}

export interface Cluster {
  id: string
  icon: string
  /** CSS gradient for the option icon tile. */
  iconBg: string
  subs: SubCluster[]
}

export const CLUSTERS: Cluster[] = [
  {
    id: 'school',
    icon: '🏫',
    iconBg: 'linear-gradient(135deg,#26C6C6,#378ADD)',
    subs: [
      {
        id: 'academic',
        emoji: '🌿',
        issues: [
          { id: 'a1', f: false },
          { id: 'a2', f: false },
          { id: 'a3', f: false },
          { id: 'a4', f: false },
          { id: 'a5', f: false },
          { id: 'a6', f: false },
          { id: 'a7', f: false },
          { id: 'a8', f: false },
          { id: 'a9', f: false },
          { id: 'a10', f: false },
          { id: 'a11', f: false },
          { id: 'a12', f: false },
        ],
      },
      {
        id: 'teacher',
        emoji: '💬',
        issues: [
          { id: 't1', f: false },
          { id: 't2', f: false },
          { id: 't3', f: false },
          { id: 't4', f: false },
          { id: 't5', f: 'amber' },
          { id: 't6', f: 'amber' },
          { id: 't7', f: 'amber' },
          { id: 't8', f: false },
        ],
      },
      {
        id: 'sleep',
        emoji: '🌙',
        xref: ['hs1'],
        issues: [
          { id: 's1', f: false },
          { id: 's2', f: false },
          { id: 's3', f: false },
          { id: 's4', f: 'amber' },
          { id: 's6', f: false },
          { id: 's7', f: false },
        ],
      },
      {
        id: 'leaving',
        emoji: '🚪',
        issues: [
          { id: 'lv1', f: 'amber' },
          { id: 'lv2', f: 'amber' },
          { id: 'lv3', f: 'red' },
          { id: 'lv4', f: 'amber' },
          { id: 'lv5', f: 'amber' },
          { id: 'lv6', f: 'amber' },
          { id: 'lv7', f: 'red' },
          { id: 'lv8', f: false },
          { id: 'lv9', f: 'amber' },
          { id: 'lv10', f: 'amber' },
          { id: 'lv11', f: false },
        ],
      },
      {
        id: 'settling',
        emoji: '🧳',
        issues: [
          { id: 'st1', f: 'amber' },
          { id: 'st2', f: false },
          { id: 'st3', f: false },
          { id: 'st4', f: 'amber' },
          { id: 'st5', f: false },
        ],
      },
      {
        id: 'groups',
        emoji: '🎯',
        xref: ['a9', 'fu2'],
        issues: [
          { id: 'gr1', f: false },
          { id: 'gr2', f: 'amber' },
          { id: 'gr3', f: false },
          { id: 'gr4', f: 'amber' },
          { id: 'gr5', f: 'amber' },
          { id: 'gr6', f: 'amber' },
          { id: 'gr7', f: false },
          { id: 'gr8', f: 'amber' },
          { id: 'gr9', f: 'amber' },
          { id: 'gr10', f: false },
          { id: 'gr11', f: false },
        ],
      },
    ],
  },
  {
    id: 'friends',
    icon: '💗',
    iconBg: 'linear-gradient(135deg,#D4537E,#FF8FAB)',
    subs: [
      {
        id: 'friendship',
        emoji: '🌸',
        issues: [
          { id: 'f1', f: false },
          { id: 'f2', f: false },
          { id: 'f3', f: false },
          { id: 'f4', f: false },
          { id: 'f5', f: false },
          { id: 'f6', f: false },
          { id: 'f7', f: false },
          { id: 'f8', f: false },
          { id: 'f9', f: 'amber' },
          { id: 'f10', f: 'amber' },
        ],
      },
      {
        id: 'romantic',
        emoji: '❤️',
        issues: [
          { id: 'r1', f: false },
          { id: 'r2', f: false },
          { id: 'r3', f: false },
          { id: 'r4', f: false },
          { id: 'r5', f: false },
          { id: 'r6', f: 'amber' },
          { id: 'r7', f: false },
        ],
      },
      {
        id: 'boundaries',
        emoji: '⚖️',
        issues: [
          { id: 'b1', f: 'amber' },
          { id: 'b2', f: 'red' },
          { id: 'b3', f: 'amber' },
          { id: 'b4', f: false },
          { id: 'b5', f: false },
          { id: 'b6', f: 'red' },
          { id: 'b7', f: false },
          { id: 'b8', f: 'red' },
          { id: 'b9', f: 'red' },
          { id: 'b10', f: 'amber' },
          { id: 'b11', f: 'amber' },
          { id: 'b12', f: 'red' },
        ],
      },
    ],
  },
  {
    id: 'feelings',
    icon: '💜',
    iconBg: 'linear-gradient(135deg,#9B6EE0,#C084E8)',
    subs: [
      {
        id: 'lowmood',
        emoji: '💭',
        xref: ['sa6'],
        issues: [
          { id: 'lm1', f: false },
          { id: 'lm2', f: false },
          { id: 'lm3', f: false },
          { id: 'lm4', f: 'amber' },
          { id: 'lm5', f: false },
          { id: 'lm6', f: 'amber' },
          { id: 'lm7', f: false },
        ],
      },
      {
        id: 'anxiety',
        emoji: '🌪️',
        issues: [
          { id: 'ax1', f: false },
          { id: 'ax2', f: false },
          { id: 'ax3', f: false },
          { id: 'ax4', f: false },
          { id: 'ax5', f: 'amber' },
          { id: 'ax6', f: false },
          { id: 'ax7', f: false },
        ],
      },
      {
        id: 'anger',
        emoji: '🔥',
        issues: [
          { id: 'ag1', f: false },
          { id: 'ag2', f: false },
          { id: 'ag3', f: 'amber' },
          { id: 'ag4', f: 'amber' },
          { id: 'ag5', f: false },
          { id: 'ag6', f: false },
        ],
      },
      {
        id: 'bodyclock',
        emoji: '🌗',
        xref: ['s3'],
        issues: [
          { id: 'sh2', f: false },
          { id: 'sh3', f: false },
          { id: 'bc1', f: false },
          { id: 'bc2', f: false },
          { id: 'bc3', f: false },
          { id: 'bc4', f: false },
          { id: 'bc5', f: 'amber' },
          { id: 'bc6', f: false },
        ],
      },
      {
        id: 'heavy',
        emoji: '💜',
        issues: [
          { id: 'sa6', f: 'red' },
          { id: 'si2', f: 'red' },
          { id: 'si3', f: 'red' },
          { id: 'sh1', f: 'red' },
          { id: 'si4', f: 'red' },
          { id: 'si5', f: 'red' },
          { id: 'si6', f: 'amber' },
          { id: 'si7', f: 'red' },
        ],
      },
      {
        id: 'truth',
        emoji: '🤞',
        xref: ['tr1'],
        issues: [
          { id: 'mt1', f: false },
          { id: 'mt2', f: false },
          { id: 'mt3', f: 'amber' },
          { id: 'mt4', f: 'amber' },
          { id: 'mt6', f: false },
          { id: 'mt7', f: 'amber' },
        ],
      },
    ],
  },
  {
    id: 'home',
    icon: '🏡',
    iconBg: 'linear-gradient(135deg,#1D9E75,#26C6A0)',
    subs: [
      {
        id: 'homesick',
        emoji: '🏡',
        issues: [
          { id: 'hs1', f: false },
          { id: 'hs2', f: false },
          { id: 'hs3', f: false },
          { id: 'hs4', f: false },
          { id: 'hs5', f: false },
          { id: 'hs6', f: false },
          { id: 'hs7', f: false },
        ],
      },
      {
        id: 'family',
        emoji: '🌿',
        xref: ['fm11', 'mn1'],
        issues: [
          { id: 'fm1', f: false },
          { id: 'fm2', f: false },
          { id: 'fm3', f: 'amber' },
          { id: 'fm4', f: false },
          { id: 'fm5', f: 'amber' },
          { id: 'fm6', f: 'red' },
          { id: 'fm7', f: false },
          { id: 'fm9', f: 'amber' },
          { id: 'fm10', f: false },
        ],
      },
      {
        id: 'alone',
        emoji: '🕊️',
        xref: ['ls1', 'fm7', 'fu1'],
        issues: [
          { id: 'ap1', f: false },
          { id: 'ap2', f: false },
          { id: 'fm11', f: false },
          { id: 'ap3', f: 'red' },
          { id: 'ap4', f: 'red' },
          { id: 'ap5', f: 'amber' },
          { id: 'ap6', f: 'amber' },
          { id: 'ap7', f: 'amber' },
        ],
      },
      {
        id: 'loss',
        emoji: '💔',
        xref: ['ap1'],
        issues: [
          { id: 'ls1', f: false },
          { id: 'ls2', f: false },
          { id: 'ls3', f: false },
          { id: 'ls4', f: 'amber' },
          { id: 'ls5', f: 'amber' },
        ],
      },
      {
        id: 'body',
        emoji: '🌱',
        issues: [
          { id: 'bd1', f: false },
          { id: 'bd2', f: false },
          { id: 'bd3', f: false },
          { id: 'bd4', f: false },
          { id: 'bd7', f: 'amber' },
          { id: 'bd8', f: 'amber' },
        ],
      },
      {
        id: 'disability',
        emoji: '♿',
        issues: [
          { id: 'dis1', f: false },
          { id: 'dis2', f: 'amber' },
          { id: 'dis3', f: 'amber' },
          { id: 'dis4', f: false },
          { id: 'dis5', f: 'amber' },
          { id: 'dis6', f: false },
          { id: 'bd5', f: false },
          { id: 'dis7', f: false },
          { id: 'dis8', f: 'amber' },
          { id: 'dis9', f: 'amber' },
          { id: 'dis10', f: 'amber' },
          { id: 'bd6', f: false },
          { id: 'dis11', f: false },
          { id: 'dis12', f: 'amber' },
          { id: 'dis13', f: false },
          { id: 'dis15', f: 'amber' },
        ],
      },
    ],
  },
  {
    id: 'safety',
    icon: '🛡️',
    iconBg: 'linear-gradient(135deg,#E24B4A,#D85A30)',
    subs: [
      {
        id: 'bullying',
        emoji: '⚡',
        issues: [
          { id: 'vb1', f: false },
          { id: 'vb2', f: 'amber' },
          { id: 'vb3', f: 'amber' },
          { id: 'vb4', f: 'amber' },
          { id: 'vb5', f: 'amber' },
          { id: 'vb6', f: 'amber' },
          { id: 'vb7', f: 'amber' },
          { id: 'vb8', f: 'amber' },
        ],
      },
      {
        id: 'abuse',
        emoji: '🚨',
        issues: [
          { id: 'sa1', f: 'red' },
          { id: 'sa2', f: 'red' },
          { id: 'sa3', f: 'red' },
          { id: 'sa4', f: 'red' },
          { id: 'sa5', f: 'red' },
          { id: 'sa7', f: 'red' },
          { id: 'sa8', f: 'red' },
        ],
      },
      {
        id: 'trauma',
        emoji: '💬',
        xref: ['sh1'],
        issues: [
          { id: 'tr1', f: false },
          { id: 'tr2', f: false },
          { id: 'tr3', f: false },
          { id: 'tr4', f: false },
          { id: 'tr6', f: 'amber' },
          { id: 'tr7', f: 'amber' },
        ],
      },
    ],
  },
  {
    id: 'identity',
    icon: '🌈',
    iconBg: 'linear-gradient(135deg,#EF9F27,#D4537E)',
    subs: [
      {
        id: 'belonging',
        emoji: '🌈',
        issues: [
          { id: 'bl1', f: false },
          { id: 'bl2', f: false },
          { id: 'bl3', f: false },
          { id: 'bl4', f: false },
        ],
      },
      {
        id: 'digital',
        emoji: '💻',
        xref: ['vb4'],
        issues: [
          { id: 'ds1', f: false },
          { id: 'ds2', f: 'red' },
          { id: 'ds3', f: 'red' },
          { id: 'ds4', f: false },
          { id: 'ds5', f: 'red' },
          { id: 'ds7', f: false },
        ],
      },
      {
        id: 'gender',
        emoji: '🪷',
        issues: [
          { id: 'gi1', f: false },
          { id: 'gi2', f: false },
          { id: 'gi3', f: false },
          { id: 'gi4', f: false },
          { id: 'gi5', f: 'amber' },
          { id: 'gi6', f: false },
          { id: 'gi7', f: 'amber' },
        ],
      },
    ],
  },
  {
    id: 'habits',
    icon: '🔄',
    iconBg: 'linear-gradient(135deg,#2ECC71,#1D9E75)',
    subs: [
      {
        id: 'substances',
        emoji: '🚬',
        issues: [
          { id: 'sub1', f: false },
          { id: 'sub2', f: false },
          { id: 'sub3', f: 'amber' },
          { id: 'sub4', f: 'amber' },
          { id: 'sub5', f: 'red' },
          { id: 'sub6', f: 'amber' },
          { id: 'sub7', f: 'amber' },
          { id: 'sub8', f: 'amber' },
          { id: 'sub9', f: 'red' },
        ],
      },
      {
        id: 'screens',
        emoji: '📱',
        issues: [
          { id: 'scr1', f: false },
          { id: 'scr2', f: false },
          { id: 'scr3', f: false },
          { id: 'scr4', f: false },
          { id: 'scr5', f: false },
          { id: 'scr6', f: false },
        ],
      },
      {
        id: 'compulsive',
        emoji: '🔁',
        issues: [
          { id: 'cmp1', f: false },
          { id: 'cmp2', f: false },
          { id: 'cmp3', f: false },
          { id: 'cmp4', f: false },
          { id: 'cmp5', f: 'amber' },
          { id: 'cmp6', f: 'amber' },
          { id: 'cmp7', f: 'amber' },
        ],
      },
    ],
  },
  {
    id: 'life',
    icon: '🎒',
    iconBg: 'linear-gradient(135deg,#EF9F27,#D85A30)',
    subs: [
      {
        id: 'money',
        emoji: '💰',
        issues: [
          { id: 'mn1', f: 'amber' },
          { id: 'mn2', f: false },
          { id: 'mn3', f: 'amber' },
          { id: 'mn4', f: 'amber' },
          { id: 'mn5', f: 'amber' },
          { id: 'mn6', f: 'amber' },
        ],
      },
      {
        id: 'respons',
        emoji: '🫂',
        issues: [
          { id: 'rs1', f: false },
          { id: 'rs2', f: false },
          { id: 'rs3', f: false },
          { id: 'rs4', f: false },
          { id: 'rs5', f: false },
        ],
      },
      {
        id: 'future',
        emoji: '🧭',
        xref: ['dis13'],
        issues: [
          { id: 'fu1', f: false },
          { id: 'fu2', f: false },
          { id: 'fu3', f: false },
          { id: 'fu4', f: false },
          { id: 'fu5', f: false },
        ],
      },
    ],
  },
]

/** Emotion pills offered after every issue pick. Labels live at cluster.emotions.<id>. */
export const EMOTIONS: { id: string; em: string }[] = [
  { id: 'sad', em: '😢' },
  { id: 'worried', em: '😨' },
  { id: 'angry', em: '😠' },
  { id: 'guilty', em: '😔' },
  { id: 'numb', em: '😶' },
  { id: 'confused', em: '😕' },
  { id: 'tired', em: '😮‍💨' },
  { id: 'ashamed', em: '🙈' },
  { id: 'scared', em: '😰' },
  { id: 'ok', em: '🙂' },
  { id: 'unknown', em: '🤷' },
]

/** The most the child may carry into one session. */
export const BASKET_MAX = 3

/**
 * v2/v3 ids retired into canonical ids. Kept so historic CLUSTER_FLAG rows map
 * forward and prevalence series stay continuous across the v3.1 merge.
 */
export const MERGED_IDS: Record<string, string> = {
  tr5: 'sh1', // self-harm history (was duplicated red in Trauma)
  s5: 'hs1', // missing home (was duplicated in Nights & Sleep)
  ap8: 'fu1', // worry about life after school
  mt5: 'tr1', // carrying an untold secret
  ds6: 'vb4', // being attacked in an online group
  fm8: 'mn1', // household money shortage
}

export function canonicalId(id: string): string {
  return MERGED_IDS[id] || id
}

export interface ItemRecord {
  iss: ClusterItem
  clusterId: string
  subId: string
}

/** Every item is DEFINED exactly once; this is where that is enforced. */
export const ITEM_INDEX: Record<string, ItemRecord> = {}
for (const c of CLUSTERS) {
  for (const sb of c.subs) {
    for (const iss of sb.issues) {
      if (ITEM_INDEX[iss.id]) console.error('DUPLICATE CANONICAL ID:', iss.id)
      ITEM_INDEX[iss.id] = { iss, clusterId: c.id, subId: sb.id }
    }
  }
}

export interface RenderedItem {
  iss: ClusterItem
  /** True when the item is on loan from another sub-cluster via xref. */
  borrowed: boolean
  /** Sub-cluster id the borrowed item is actually defined in. */
  homeSubId?: string
}

/** What a sub-cluster shows the child: its own items first, then borrowed ones. */
export function subItems(sb: SubCluster): RenderedItem[] {
  const out: RenderedItem[] = sb.issues.map((iss) => ({ iss, borrowed: false }))
  for (const id of sb.xref ?? []) {
    const rec = ITEM_INDEX[canonicalId(id)]
    if (rec) out.push({ iss: rec.iss, borrowed: true, homeSubId: rec.subId })
  }
  return out
}

export interface TaxonomyStats {
  clusters: number
  subs: number
  /** Canonical definitions. THE DENOMINATOR FOR EVERY RATE — never `placements`. */
  items: number
  /** Canonical + borrowed renders. A browse-path number, never an analysis one. */
  placements: number
  borrowed: number
  red: number
  amber: number
}

export function taxStats(): TaxonomyStats {
  let items = 0
  let subs = 0
  let red = 0
  let amber = 0
  let borrowed = 0
  for (const c of CLUSTERS) {
    subs += c.subs.length
    for (const sb of c.subs) {
      items += sb.issues.length
      borrowed += (sb.xref ?? []).length
      for (const i of sb.issues) {
        if (i.f === 'red') red++
        else if (i.f === 'amber') amber++
      }
    }
  }
  return { clusters: CLUSTERS.length, subs, items, placements: items + borrowed, borrowed, red, amber }
}

export interface TaxonomyIntegrity {
  canonical: number
  dupes: string[]
  broken: string[]
  placements: number
}

/** Cheap self-check surfaced in the dev drawer: duplicate ids and dangling xrefs. */
export function validateTaxonomy(): TaxonomyIntegrity {
  const seen: Record<string, true> = {}
  const dupes: string[] = []
  const broken: string[] = []
  let placements = 0
  for (const c of CLUSTERS) {
    for (const sb of c.subs) {
      for (const i of sb.issues) {
        if (seen[i.id]) dupes.push(i.id)
        seen[i.id] = true
      }
      placements += subItems(sb).length
      for (const id of sb.xref ?? []) {
        if (!ITEM_INDEX[canonicalId(id)]) broken.push(sb.id + '→' + id)
      }
    }
  }
  return { canonical: Object.keys(seen).length, dupes, broken, placements }
}

export function findCluster(id: string): Cluster | undefined {
  return CLUSTERS.find((c) => c.id === id)
}

export function findSub(cluster: Cluster | undefined, subId: string): SubCluster | undefined {
  return cluster?.subs.find((s) => s.id === subId)
}
