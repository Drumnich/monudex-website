import fs from "node:fs/promises";

const cataloguePath = new URL("../data/monuments.json", import.meta.url);
let catalogue = await fs.readFile(cataloguePath, "utf8");
const monuments = JSON.parse(catalogue);

// Hand-checked monument or immediate-location photographs. Keep this list explicit so
// catalogue refreshes cannot silently replace real places with flags, maps, or logos.
const replacements = new Map(Object.entries({
  "algeria-tipasa-archaeological-park": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Roman_ruins_of_Tipaza.jpg/1280px-Roman_ruins_of_Tipaza.jpg",
  "bahamas-parliament-square-nassau": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Parliament_Square%2C_Nassau%2C_The_Bahamas.jpg/1280px-Parliament_Square%2C_Nassau%2C_The_Bahamas.jpg",
  "belize-belize-barrier-reef-reserve-system": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Belize_Barrier_Reef%2C_Ambergris_Caye%2C_Belize.jpg/1280px-Belize_Barrier_Reef%2C_Ambergris_Caye%2C_Belize.jpg",
  "bosnia-and-herzegovina-mehmed-pasa-sokolovic-bridge-visegrad": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Mehmed_Pasa_Sokolovic_Bridge_Visegrad_1900.JPG/1280px-Mehmed_Pasa_Sokolovic_Bridge_Visegrad_1900.JPG",
  "brunei-sultan-omar-ali-saifuddien-mosque": "https://upload.wikimedia.org/wikipedia/commons/2/2b/Sultan_Omar_Ali_Saifuddin_Mosque_with_the_ceremonial_ship.jpg",
  "burkina-faso-grand-mosque-of-bobo-dioulasso": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Moschee_von_Bobo-Dioulasso.jpg/1280px-Moschee_von_Bobo-Dioulasso.jpg",
  "burundi-gishora-drum-sanctuary": "https://upload.wikimedia.org/wikipedia/commons/7/75/Gishora_sanctuary-Burundi_Tour.jpg",
  "burundi-national-museum-of-gitega": "https://upload.wikimedia.org/wikipedia/commons/e/ee/BU_Gitega_%281%29.jpg",
  "cape-verde-cidade-velha-historic-centre-of-ribeira-grande": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Cidade_Velha-C%C3%A2mara_Municipal_de_Ribeira_Grande_de_Santiago.jpg/1280px-Cidade_Velha-C%C3%A2mara_Municipal_de_Ribeira_Grande_de_Santiago.jpg",
  "cambodia-royal-palace-phnom-penh": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Royal_Palace%2C_Phnom_Penh_Cambodia_1.jpg/1280px-Royal_Palace%2C_Phnom_Penh_Cambodia_1.jpg",
  "central-african-republic-barthelemy-boganda-monument-bangui": "https://upload.wikimedia.org/wikipedia/commons/4/48/MONUMENT_BOGANDA.jpg",
  "comoros-iconi-friday-mosque": "https://upload.wikimedia.org/wikipedia/commons/d/d2/Grande_Comore-Iconi-Ancienne_capitale.jpg",
  "cuba-old-havana-and-its-fortifications": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Havana_-_Cuba_-_3195.jpg/1280px-Havana_-_Cuba_-_3195.jpg",
  "czechia-charles-bridge-prague": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Prague_07-2016_view_from_Lesser_Town_Tower_of_Charles_Bridge_img3.jpg/1280px-Prague_07-2016_view_from_Lesser_Town_Tower_of_Charles_Bridge_img3.jpg",
  "czechia-prague-castle": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/PragueCastle.jpg/1280px-PragueCastle.jpg",
  "czechia-cesky-krumlov-historic-centre": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Cesky_Krumlov_25.JPG/1280px-Cesky_Krumlov_25.JPG",
  "dominica-fort-shirley-cabrits-national-park": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Fort_Shirley%2C_Portsmouth%2C_Domininca.JPG/1280px-Fort_Shirley%2C_Portsmouth%2C_Domininca.JPG",
  "dr-congo-garamba-national-park": "https://upload.wikimedia.org/wikipedia/commons/1/1d/Garamba_National_Park_overhead.jpg",
  "djibouti-people-s-palace-djibouti-city": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/The_People%27s_Palace%2C_Djibouti_City.jpg/1280px-The_People%27s_Palace%2C_Djibouti_City.jpg",
  "equatorial-guinea-santa-isabel-cathedral-malabo": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Kathedrale_Santa_Isabel.jpg/1280px-Kathedrale_Santa_Isabel.jpg",
  "equatorial-guinea-basilica-of-the-immaculate-conception-mongomo": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Basilica_of_the_Immaculate_Conception%2C_Mongomo.jpg/1280px-Basilica_of_the_Immaculate_Conception%2C_Mongomo.jpg",
  "eritrea-tank-graveyard-asmara": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/The_%22Tank_Graveyard%22_Asmara%2C_Eritrea_%2830780643175%29.jpg/1280px-The_%22Tank_Graveyard%22_Asmara%2C_Eritrea_%2830780643175%29.jpg",
  "ethiopia-aksum-obelisks": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Axum_stelae_%285499087338%29.jpg/1280px-Axum_stelae_%285499087338%29.jpg",
  "eswatini-mantenga-cultural-village": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Mantenga_Cultural_Village_%287045460659%29_%283%29.jpg/1280px-Mantenga_Cultural_Village_%287045460659%29_%283%29.jpg",
  "eswatini-king-sobhuza-ii-memorial-park": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Image_of_King_Sobhuza_II_Memorial_Park.jpg/1280px-Image_of_King_Sobhuza_II_Memorial_Park.jpg",
  "gabon-st-michael-s-cathedral-libreville": "https://upload.wikimedia.org/wikipedia/commons/8/8d/Cathedral_of_Saint-Marie%2C_Libreville.jpg",
  "gabon-leon-mba-memorial-libreville": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/The_Leon_Mba_Memorial_-_Libreville%2C_Gabon_-_2023.jpg/1280px-The_Leon_Mba_Memorial_-_Libreville%2C_Gabon_-_2023.jpg",
  "ghana-kwame-nkrumah-memorial-park": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Kwame_Nkrumah_Memorial_Park_%26_Mausoleum.jpg/1280px-Kwame_Nkrumah_Memorial_Park_%26_Mausoleum.jpg",
  "guatemala-antigua-guatemala": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Antigua_-_Arco.jpg/1280px-Antigua_-_Arco.jpg",
  "guinea-fouta-djallon-highlands": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Chute_de_Ditinn_%C3%A0_Dalaba.jpg/1280px-Chute_de_Ditinn_%C3%A0_Dalaba.jpg",
  "guinea-monument-du-22-novembre-conakry": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Monument_du_22_Novembre_%28Conakry%29.jpg/1280px-Monument_du_22_Novembre_%28Conakry%29.jpg",
  "guinea-bissau-presidential-palace-ruins-bissau": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Presidentialpalacebissau.jpg/1280px-Presidentialpalacebissau.jpg",
  "haiti-iron-market-port-au-prince": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Iron_Market%2C_Haiti.jpg/1280px-Iron_Market%2C_Haiti.jpg",
  "ivory-coast-st-pauls-cathedral-abidjan": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Cathedrale_St_Paul_Abidjan_1.jpg/1280px-Cathedrale_St_Paul_Abidjan_1.jpg",
  "jamaica-devon-house-kingston": "https://upload.wikimedia.org/wikipedia/commons/7/7d/Devonhouse.jpg",
  "kenya-giraffe-centre-nairobi-landmark": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Giraffe_Center%2C_Nairobi.jpg/1280px-Giraffe_Center%2C_Nairobi.jpg",
  "kuwait-kuwait-towers": "https://upload.wikimedia.org/wikipedia/en/thumb/8/8c/Kuwait_Towers_RB.jpg/1280px-Kuwait_Towers_RB.jpg",
  "latvia-riga-old-town": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Riga_%2833844464828%29.jpg/1280px-Riga_%2833844464828%29.jpg",
  "liberia-centennial-pavilion-monrovia": "https://live.staticflickr.com/6143/6040473163_bb30e76781_b.jpg",
  "liberia-providence-island-monrovia": "https://upload.wikimedia.org/wikipedia/commons/9/9d/Providence_Island_view_of_downtown_Monrovia.jpg",
  "liechtenstein-liechtenstein-national-museum": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Liechtensteinisches_LandesMuseum_in_Vaduz.jpg/1280px-Liechtensteinisches_LandesMuseum_in_Vaduz.jpg",
  "marshall-islands-majuro-peace-park": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Peace_Memorial_Park%2C_Denkmal.JPG/1280px-Peace_Memorial_Park%2C_Denkmal.JPG",
  "malaysia-petronas-twin-towers-kuala-lumpur": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Petronas_Twin_Towers%2C_Kuala_Lumpur%2C_Malaysia_%282%29.jpg/1280px-Petronas_Twin_Towers%2C_Kuala_Lumpur%2C_Malaysia_%282%29.jpg",
  "maldives-tsunami-monument-male": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Male%27_Tsunami_Monument_14.jpg/1280px-Male%27_Tsunami_Monument_14.jpg",
  "mauritania-banc-darguin-national-park": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Iwik._Village_du_Banc_d%27Arguin_en_Mauritanie.jpg/1280px-Iwik._Village_du_Banc_d%27Arguin_en_Mauritanie.jpg",
  "micronesia-lelu-ruins": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Lelu_Ruins%2C_Kosrae%2C_Micronesia.jpg/1280px-Lelu_Ruins%2C_Kosrae%2C_Micronesia.jpg",
  "moldova-orheiul-vechi": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Stanca_deasupra_Rautului_Butuceni.jpg/1280px-Stanca_deasupra_Rautului_Butuceni.jpg",
  "monaco-monaco-cathedral": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Monaco_BW_2011-06-07_16-07-20.jpg/1280px-Monaco_BW_2011-06-07_16-07-20.jpg",
  "mozambique-fortress-of-maputo": "https://upload.wikimedia.org/wikipedia/commons/8/8f/Fortaleza_de_Nossa_Senhora_da_Concei%C3%A7%C3%A3o_%281946%29_%284107934371%29.jpg",
  "mozambique-island-of-mozambique": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Ilha_de_Mocambique.jpg/1280px-Ilha_de_Mocambique.jpg",
  "nauru-command-ridge-wwii-relics": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Aiwo.jpg/1280px-Aiwo.jpg",
  "nauru-parliament-house-yaren": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Parliament_%2815403802091%29.jpg/1280px-Parliament_%2815403802091%29.jpg",
  "north-macedonia-ohrid-old-town-and-lake-ohrid": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Lake_Ohrid_by_Ohrid_old_city.JPG/1280px-Lake_Ohrid_by_Ohrid_old_city.JPG",
  "panama-panama-canal": "https://upload.wikimedia.org/wikipedia/commons/a/a2/Panama_Canal_-_Pacific_Side_Entrance.jpg",
  "panama-panama-viejo": "https://upload.wikimedia.org/wikipedia/commons/0/0e/Torre_de_panama_viejo.jpg",
  "papua-new-guinea-bomana-war-cemetery": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/View_of_Nine-Mile_Quarry_from_Bomana_War_Cemetery_near_Port_Moresby.jpg/1280px-View_of_Nine-Mile_Quarry_from_Bomana_War_Cemetery_near_Port_Moresby.jpg",
  "romania-painted-monasteries-of-bucovina": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Biserica_m%C4%83n%C4%83stirii_Humor%2C_Turnul.JPG/1280px-Biserica_m%C4%83n%C4%83stirii_Humor%2C_Turnul.JPG",
  "saint-kitts-and-nevis-brimstone-hill-fortress": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/BrimstoneHill01.jpg/1280px-BrimstoneHill01.jpg",
  "saint-vincent-and-the-grenadines-fort-charlotte-kingstown": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Entrance_to_Fort_Charlotte%2C_Kingstown%2C_St._Vincent.jpg/1280px-Entrance_to_Fort_Charlotte%2C_Kingstown%2C_St._Vincent.jpg",
  "saint-vincent-and-the-grenadines-st-george-s-cathedral-kingstown": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Kingstown_-_St._George%27s_Anglican_Cathedral_-_panoramio.jpg/1280px-Kingstown_-_St._George%27s_Anglican_Cathedral_-_panoramio.jpg",
  "san-marino-palazzo-pubblico-san-marino": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Palazzo_Pubblico_%28San_Marino%29.jpg/1280px-Palazzo_Pubblico_%28San_Marino%29.jpg",
  "saudi-arabia-al-hijr-hegra-archaeological-site": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Mada%27in_Saleh_Al-Hijr_Hegra_%28%D9%85%D8%AF%D8%A7%D8%A6%D9%86_%D8%B5%D8%A7%D9%84%D8%AD%29_%288136618664%29.jpg/1280px-Mada%27in_Saleh_Al-Hijr_Hegra_%28%D9%85%D8%AF%D8%A7%D8%A6%D9%86_%D8%B5%D8%A7%D9%84%D8%AD%29_%288136618664%29.jpg",
  "saudi-arabia-at-turaif-district-in-diriyah": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/At-Turaif_District_in_ad-Dir%27iyah_%281%29.jpg/1280px-At-Turaif_District_in_ad-Dir%27iyah_%281%29.jpg",
  "saudi-arabia-historic-jeddah": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Old_Jeddah_%28Al_Balad%29_architecture_3_Feb_2022.jpg/1280px-Old_Jeddah_%28Al_Balad%29_architecture_3_Feb_2022.jpg",
  "seychelles-clock-tower-victoria": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Victoria_Clock_Tower_-_Seychelles.JPG/1280px-Victoria_Clock_Tower_-_Seychelles.JPG",
  "seychelles-mission-lodge-lookout": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/View_from_Mission_Lodge_Lookout%2C_Mah%C3%A9%2C_Seychelles.jpg/1280px-View_from_Mission_Lodge_Lookout%2C_Mah%C3%A9%2C_Seychelles.jpg",
  "sierra-leone-st-john-s-maroon-church-freetown": "https://upload.wikimedia.org/wikipedia/commons/9/9e/St._John%27s_Maroon_Church_in_Freetown_-_Mapillary_%28EDeX7FCMQ9WZ6NiQo7Ykcw%29.jpg",
  "singapore-merlion-park": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Singapore_Merlion_BCT.jpg/1280px-Singapore_Merlion_BCT.jpg",
  "solomon-islands-east-rennell": "https://upload.wikimedia.org/wikipedia/commons/2/2c/Dugout_canoe_Rennell.jpg",
  "solomon-islands-guadalcanal-american-memorial": "https://upload.wikimedia.org/wikipedia/commons/0/05/Guadalcanal_American_Memorial.jpg",
  "south-sudan-all-saints-cathedral-juba": "https://juba.anglican.org/wp-content/uploads/sites/3/2019/12/All-Saints-Cathedral.jpeg",
  "south-sudan-juba-bridge": "https://upload.wikimedia.org/wikipedia/commons/9/9c/Sudan_Juba_bridge.jpg",
  "sudan-national-museum-of-sudan-khartoum": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/SUDAN_NATIONAL_MUSEUM.JPG/1280px-SUDAN_NATIONAL_MUSEUM.JPG",
  "tajikistan-hulbuk-fortress": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Hulbuk_Fort_in_Pingan%2C_Tajikistan.jpg/1280px-Hulbuk_Fort_in_Pingan%2C_Tajikistan.jpg",
  "timor-leste-dare-memorial-museum": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/2018-08-17_Dare.jpg/1280px-2018-08-17_Dare.jpg",
  "timor-leste-motael-church-dili": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Saint_Anthony_of_Padua_Church_%28Motael%29%2C_2023_%2802%29.jpg/1280px-Saint_Anthony_of_Padua_Church_%28Motael%29%2C_2023_%2802%29.jpg",
  "tunisia-carthage-archaeological-site": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Archaeological_Site_of_Carthage-130237.jpg/1280px-Archaeological_Site_of_Carthage-130237.jpg",
  "trinidad-and-tobago-fort-king-george-tobago": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Lighthouse_At_Fort_King_George_Tobago_%28145874753%29.jpeg/1280px-Lighthouse_At_Fort_King_George_Tobago_%28145874753%29.jpeg",
  "turkiye-ephesus-ancient-city": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Ephesus_Ancient_City_-_2014.10_-_panoramio.jpg/1280px-Ephesus_Ancient_City_-_2014.10_-_panoramio.jpg",
  "tuvalu-funafuti-conservation-area": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Tuvalu_Funafuti_atoll_beach.jpg/1280px-Tuvalu_Funafuti_atoll_beach.jpg",
  "tuvalu-tuvalu-government-building-funafuti": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Government_office_building.jpg/1280px-Government_office_building.jpg",
  "tuvalu-world-war-ii-plane-wreck-nanumea": "https://upload.wikimedia.org/wikipedia/commons/5/5d/Nanumea.jpg",
  "united-arab-emirates-al-ain-oasis": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Al-Ain_Oasis_%281%29.jpg/1280px-Al-Ain_Oasis_%281%29.jpg",
  "uruguay-palacio-salvo-montevideo": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Palacio_Salvo._Montevideo_-_Uruguay..JPG/1280px-Palacio_Salvo._Montevideo_-_Uruguay..JPG",
  "vanuatu-mele-cascades": "https://upload.wikimedia.org/wikipedia/commons/3/3e/Mele_Cascades.jpg",
  "vanuatu-million-dollar-point": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Espiritu_Santo_Island%2C_Vanuatu.jpg/1280px-Espiritu_Santo_Island%2C_Vanuatu.jpg",
  "vatican-city-sistine-chapel": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/The_Sistine_Chapel_in_Vatican_City_%2851296438953%29.jpg/1280px-The_Sistine_Chapel_in_Vatican_City_%2851296438953%29.jpg",
  "vatican-city-vatican-museums": "https://upload.wikimedia.org/wikipedia/commons/f/fa/Lightmatter_vaticanmuseum.jpg",
}));

const knownIds = new Set(monuments.map((monument) => monument.id));
const unknownIds = [...replacements.keys()].filter((id) => !knownIds.has(id));
if (unknownIds.length) throw new Error(`Unknown monument ids: ${unknownIds.join(", ")}`);

let changed = 0;
for (const [id, photo] of replacements) {
  const monument = monuments.find((entry) => entry.id === id);
  if (monument.photo === photo) continue;

  const idMarker = `"id":${JSON.stringify(id)}`;
  const monumentStart = catalogue.indexOf(idMarker);
  const nextMonument = catalogue.indexOf('"id":', monumentStart + idMarker.length);
  const monumentEnd = nextMonument === -1 ? catalogue.length : nextMonument;
  const before = catalogue.slice(0, monumentStart);
  const block = catalogue.slice(monumentStart, monumentEnd);
  const after = catalogue.slice(monumentEnd);
  const updatedBlock = block.replace(/"photo":\s*"[^"]*"/, `"photo": ${JSON.stringify(photo)}`);
  if (updatedBlock === block) throw new Error(`Could not update photo for ${id}`);
  catalogue = `${before}${updatedBlock}${after}`;
  changed += 1;
}

await fs.writeFile(cataloguePath, catalogue);
process.stdout.write(`Curated ${changed} of ${replacements.size} listed monument images.\n`);
