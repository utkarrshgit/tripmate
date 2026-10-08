import ItinerarySection from "./ItinerarySection";
import OptionsSection from "./OptionsSection";
import ProvenanceSection from "./ProvenanceSection";
import SpendSection from "./SpendSection";
import ThingsToDoSection from "./ThingsToDoSection";

export { default as TripHero } from "./TripHero";

/*
 * The sections of a trip plan below the hero, top to bottom. Each receives
 * { plan, query, onEditRequest } and returns null when it has nothing to show.
 * To add a section: create a component here and insert it in this list.
 * Keep them visual: a title, then data — no intro paragraphs.
 */
export const TRIP_SECTIONS = [ItinerarySection, SpendSection, OptionsSection, ThingsToDoSection, ProvenanceSection];
