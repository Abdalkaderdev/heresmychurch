// US State abbreviations, names, and approximate center coordinates
export interface StateInfo {
  abbrev: string;
  name: string;
  lat: number;
  lng: number;
}

export const US_STATES: StateInfo[] = [
  { abbrev: "AL", name: "Alabama", lat: 32.806671, lng: -86.791130 },
  { abbrev: "AK", name: "Alaska", lat: 61.370716, lng: -152.404419 },
  { abbrev: "AZ", name: "Arizona", lat: 33.729759, lng: -111.431221 },
  { abbrev: "AR", name: "Arkansas", lat: 34.969704, lng: -92.373123 },
  { abbrev: "CA", name: "California", lat: 36.116203, lng: -119.681564 },
  { abbrev: "CO", name: "Colorado", lat: 39.059811, lng: -105.311104 },
  { abbrev: "CT", name: "Connecticut", lat: 41.597782, lng: -72.755371 },
  { abbrev: "DE", name: "Delaware", lat: 39.318523, lng: -75.507141 },
  { abbrev: "FL", name: "Florida", lat: 27.766279, lng: -81.686783 },
  { abbrev: "GA", name: "Georgia", lat: 33.040619, lng: -83.643074 },
  { abbrev: "HI", name: "Hawaii", lat: 21.094318, lng: -157.498337 },
  { abbrev: "ID", name: "Idaho", lat: 44.240459, lng: -114.478828 },
  { abbrev: "IL", name: "Illinois", lat: 40.349457, lng: -88.986137 },
  { abbrev: "IN", name: "Indiana", lat: 39.849426, lng: -86.258278 },
  { abbrev: "IA", name: "Iowa", lat: 42.011539, lng: -93.210526 },
  { abbrev: "KS", name: "Kansas", lat: 38.526600, lng: -96.726486 },
  { abbrev: "KY", name: "Kentucky", lat: 37.668140, lng: -84.670067 },
  { abbrev: "LA", name: "Louisiana", lat: 31.169546, lng: -91.867805 },
  { abbrev: "ME", name: "Maine", lat: 44.693947, lng: -69.381927 },
  { abbrev: "MD", name: "Maryland", lat: 39.063946, lng: -76.802101 },
  { abbrev: "MA", name: "Massachusetts", lat: 42.230171, lng: -71.530106 },
  { abbrev: "MI", name: "Michigan", lat: 43.326618, lng: -84.536095 },
  { abbrev: "MN", name: "Minnesota", lat: 45.694454, lng: -93.900192 },
  { abbrev: "MS", name: "Mississippi", lat: 32.741646, lng: -89.678696 },
  { abbrev: "MO", name: "Missouri", lat: 38.456085, lng: -92.288368 },
  { abbrev: "MT", name: "Montana", lat: 46.921925, lng: -110.454353 },
  { abbrev: "NE", name: "Nebraska", lat: 41.125370, lng: -98.268082 },
  { abbrev: "NV", name: "Nevada", lat: 38.313515, lng: -117.055374 },
  { abbrev: "NH", name: "New Hampshire", lat: 43.452492, lng: -71.563896 },
  { abbrev: "NJ", name: "New Jersey", lat: 40.298904, lng: -74.521011 },
  { abbrev: "NM", name: "New Mexico", lat: 34.840515, lng: -106.248482 },
  { abbrev: "NY", name: "New York", lat: 42.165726, lng: -74.948051 },
  { abbrev: "NC", name: "North Carolina", lat: 35.630066, lng: -79.806419 },
  { abbrev: "ND", name: "North Dakota", lat: 47.528912, lng: -99.784012 },
  { abbrev: "OH", name: "Ohio", lat: 40.388783, lng: -82.764915 },
  { abbrev: "OK", name: "Oklahoma", lat: 35.565342, lng: -96.928917 },
  { abbrev: "OR", name: "Oregon", lat: 44.572021, lng: -122.070938 },
  { abbrev: "PA", name: "Pennsylvania", lat: 40.590752, lng: -77.209755 },
  { abbrev: "RI", name: "Rhode Island", lat: 41.680893, lng: -71.511780 },
  { abbrev: "SC", name: "South Carolina", lat: 33.856892, lng: -80.945007 },
  { abbrev: "SD", name: "South Dakota", lat: 44.299782, lng: -99.438828 },
  { abbrev: "TN", name: "Tennessee", lat: 35.747845, lng: -86.692345 },
  { abbrev: "TX", name: "Texas", lat: 31.054487, lng: -97.563461 },
  { abbrev: "UT", name: "Utah", lat: 40.150032, lng: -111.862434 },
  { abbrev: "VT", name: "Vermont", lat: 44.045876, lng: -72.710686 },
  { abbrev: "VA", name: "Virginia", lat: 37.769337, lng: -78.169968 },
  { abbrev: "WA", name: "Washington", lat: 47.400902, lng: -121.490494 },
  { abbrev: "WV", name: "West Virginia", lat: 38.491226, lng: -80.954456 },
  { abbrev: "WI", name: "Wisconsin", lat: 44.268543, lng: -89.616508 },
  { abbrev: "WY", name: "Wyoming", lat: 42.755966, lng: -107.302490 },
];

export function getStateByAbbrev(abbrev: string): StateInfo | undefined {
  return US_STATES.find(s => s.abbrev === abbrev.toUpperCase());
}