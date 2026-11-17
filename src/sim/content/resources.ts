// The basic resources (SPEC "Resources and materials"). Nodes are infinite and have a
// purity like Satisfactory's. Oil is a fluid (Pump); the rest are solid (Drill).

export type ResourceId = 'iron' | 'copper' | 'gold' | 'quartz' | 'coal' | 'oil' | 'sulfur';

export const RESOURCE_IDS: ResourceId[] = ['iron', 'copper', 'gold', 'quartz', 'coal', 'oil', 'sulfur'];

export interface ResourceDef {
  id: ResourceId;
  name: string;
  fluid: boolean;
}

export const RESOURCES: Record<ResourceId, ResourceDef> = {
  iron: { id: 'iron', name: 'Iron', fluid: false },
  copper: { id: 'copper', name: 'Copper', fluid: false },
  gold: { id: 'gold', name: 'Gold', fluid: false },
  quartz: { id: 'quartz', name: 'Quartz', fluid: false },
  coal: { id: 'coal', name: 'Coal', fluid: false },
  oil: { id: 'oil', name: 'Oil', fluid: true },
  sulfur: { id: 'sulfur', name: 'Sulfur', fluid: false },
};

/** 0 Impure, 1 Normal, 2 Pure. */
export type Purity = 0 | 1 | 2;
export const PURITY_NAMES = ['Impure', 'Normal', 'Pure'] as const;
