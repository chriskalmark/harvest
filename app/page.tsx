import UgeplanSkaerm from "@/components/ugeplan/UgeplanSkaerm";

/**
 * Appens forside: ugeplanen.
 *
 * Den gamle menu ligger stadig paa /menu med sine morgenmåltider, snacks og
 * indkøbsliste. Forsiden er det spørgsmål appen findes for at besvare -- hvad
 * skal vi have at spise i aften -- og det er syv aftener, ikke fire lister.
 */
export default function Home() {
  return <UgeplanSkaerm />;
}
