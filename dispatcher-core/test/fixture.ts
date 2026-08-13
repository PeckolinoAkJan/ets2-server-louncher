export const saveWithFreeSlot = `SiiNunit
{
economy : _nameless.0000.0000.0001 {
 game_time: 12000
}
company : company.volatile.lkwlog.hamburg {
 job_offer: 3
 job_offer[0]: _nameless.1111.2222.3333
 job_offer[1]: null
 job_offer[2]: _nameless.4444.5555.6666
}
company : company.volatile.eurogoodies.berlin {
 job_offer: 0
}
company_job : _nameless.1111.2222.3333 {
 target: "eurogoodies.berlin"
 time_limit: 12020
 expiration_time: 12020
 urgency: 0
 shortest_distance_km: 290
 ferry_time: 0
 ferry_price: 0
 cargo: cargo.frozen_food
 company_truck: null
 trailer_variant: trailer_def.scs.box.single_3
 trailer_definition: trailer_def.scs.box
 units_count: 20
 fill_ratio: 1
 trailer_place: 0
 unknown_version_field: (1, 2, 3)
}
company_job : _nameless.4444.5555.6666 {
 target: "eurogoodies.berlin"
 time_limit: 13000
 expiration_time: 13000
 urgency: 1
 shortest_distance_km: 290
 ferry_time: 0
 ferry_price: 0
 cargo: cargo.electronics
 company_truck: null
 trailer_variant: trailer_def.scs.box.single_3
 trailer_definition: trailer_def.scs.box
 units_count: 12
 fill_ratio: 1
 trailer_place: 0
}
}
`;

export const request = {
  sourceCompanyUnit: 'company.volatile.lkwlog.hamburg',
  destinationCompanyUnit: 'company.volatile.eurogoodies.berlin',
  cargo: 'cargo.medical_equipment',
  trailerVariant: 'trailer_def.scs.box.single_3',
  trailerDefinition: 'trailer_def.scs.box',
  durationMinutes: 600,
  urgency: 2 as const,
  distanceKm: 310,
};

