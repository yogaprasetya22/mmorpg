import { API_BASE_URL } from "./config";

export interface MapItem {
    id: string;
    type: string;
    path: string;
    pos: [number, number, number];
    rot: [number, number, number];
    sca: [number, number, number];
    color?: string;
}

export function sanitizeAssetPath(path: string): string {
    let cleanPath = path;
    if (cleanPath.startsWith(API_BASE_URL)) {
        cleanPath = cleanPath.slice(API_BASE_URL.length);
    }

    const fileName = cleanPath.split("/").pop() || "";
    const nameLower = fileName.toLowerCase();

    if (
        nameLower.includes("rock") ||
        nameLower.includes("pebble") ||
        nameLower.includes("stone") ||
        nameLower.includes("boulder") ||
        nameLower.includes("cliff")
    ) {
        const rockFiles = [
            "RockPath_Square_Thin.glb",
            "RockPath_Round_Thin.glb",
            "Rock_Medium_3.glb",
            "Pebble_Square_1.glb",
            "Rock_Medium_1.glb",
            "Pebble_Round_2.glb",
            "Pebble_Round_5.glb",
            "RockPath_Round_Small_3.glb",
            "Pebble_Square_3.glb",
            "RockPath_Round_Small_1.glb",
            "Pebble_Round_4.glb",
            "Pebble_Round_3.glb",
            "Pebble_Square_2.glb",
            "RockPath_Square_Small_3.glb",
            "Pebble_Square_6.glb",
            "Pebble_Square_5.glb",
            "RockPath_Round_Wide.glb",
            "RockPath_Square_Small_1.glb",
            "RockPath_Square_Small_2.glb",
            "RockPath_Square_Wide.glb",
            "Pebble_Square_4.glb",
            "Rock_Medium_2.glb",
            "Pebble_Round_1.glb",
            "RockPath_Round_Small_2.glb",
        ];
        const matchedFile = rockFiles.find(
            (f) =>
                f.toLowerCase() === nameLower ||
                nameLower.startsWith(f.toLowerCase().replace(".glb", "")),
        );
        if (matchedFile) {
            return `${API_BASE_URL}/assets/environment/rocks/${matchedFile}`;
        }
        return `${API_BASE_URL}/assets/environment/rocks/Rock_Medium_1.glb`;
    }

    if (
        nameLower.includes("tree") ||
        nameLower.includes("birch") ||
        nameLower.includes("pine") ||
        nameLower.includes("maple") ||
        nameLower.includes("dead") ||
        nameLower.includes("twisted")
    ) {
        const treeFiles = [
            "Pine_5.glb",
            "DeadTree_3.glb",
            "BirchTree_4.glb",
            "DeadTree_1.glb",
            "CommonTree_5.glb",
            "DeadTree_7.glb",
            "CommonTree_1.glb",
            "DeadTree_5.glb",
            "MapleTree_5.glb",
            "Pine_1.glb",
            "DeadTree_8.glb",
            "BirchTree_3.glb",
            "DeadTree_9.glb",
            "CommonTree_4.glb",
            "DeadTree_4.glb",
            "BirchTree_5.glb",
            "TwistedTree_4.glb",
            "MapleTree_2.glb",
            "MapleTree_1.glb",
            "DeadTree_2.glb",
            "DeadTree_6.glb",
            "BirchTree_1.glb",
            "TwistedTree_3.glb",
            "Pine_4.glb",
            "CommonTree_3.glb",
            "MapleTree_4.glb",
            "CommonTree_2.glb",
            "DeadTree_10.glb",
            "Pine_3.glb",
            "BirchTree_2.glb",
            "MapleTree_3.glb",
            "Pine_2.glb",
            "TwistedTree_5.glb",
            "TwistedTree_2.glb",
            "TwistedTree_1.glb",
        ];
        const matchedFile = treeFiles.find(
            (f) =>
                f.toLowerCase() === nameLower ||
                nameLower.startsWith(f.toLowerCase().replace(".glb", "")),
        );
        if (matchedFile) {
            return `${API_BASE_URL}/assets/environment/trees/${matchedFile}`;
        }
        return `${API_BASE_URL}/assets/environment/trees/Pine_1.glb`;
    }

    if (
        nameLower.includes("bush") ||
        nameLower.includes("flower") ||
        nameLower.includes("grass") ||
        nameLower.includes("fern") ||
        nameLower.includes("mushroom") ||
        nameLower.includes("clover") ||
        nameLower.includes("plant") ||
        nameLower.includes("petal")
    ) {
        const vegFiles = [
            "Bush_Flowers.glb",
            "Petal_3.glb",
            "Bush_Common.glb",
            "Fern_1.glb",
            "Flower_1.glb",
            "Plant_1.glb",
            "Bush_Small.glb",
            "Mushroom_Laetiporus.glb",
            "Petal_5.glb",
            "Petal_1.glb",
            "Flower_1_Clump.glb",
            "Flower_4_Single.glb",
            "Flower_3_Single.glb",
            "Grass_Large.glb",
            "Mushroom_Common.glb",
            "Flower_2_Clump.glb",
            "Plant_1_Big.glb",
            "Grass_Wispy_Short.glb",
            "Plant_7.glb",
            "Grass_Common_Short.glb",
            "Flower_5_Clump.glb",
            "Bush_Small_Flowers.glb",
            "Clover_2.glb",
            "Flower_4_Clump.glb",
            "Bush_Common_Flowers.glb",
            "Grass_Wispy_Tall.glb",
            "Clover_1.glb",
            "Grass_Common_Tall.glb",
            "Bush_Large.glb",
            "Petal_4.glb",
            "Plant_7_Big.glb",
            "Grass_Large_Extruded.glb",
            "Grass_Small.glb",
            "Flower_4_Group.glb",
            "Flower_2.glb",
            "Flower_3_Clump.glb",
            "Petal_2.glb",
            "Bush_Large_Flowers.glb",
            "Flower_3_Group.glb",
            "Bush.glb",
        ];
        const matchedFile = vegFiles.find(
            (f) =>
                f.toLowerCase() === nameLower ||
                nameLower.startsWith(f.toLowerCase().replace(".glb", "")),
        );
        if (matchedFile) {
            return `${API_BASE_URL}/assets/environment/vegetation/${matchedFile}`;
        }
        return `${API_BASE_URL}/assets/environment/vegetation/Bush.glb`;
    }

    if (
        nameLower.includes("soldier") ||
        nameLower.includes("npc") ||
        nameLower.includes("chef") ||
        nameLower.includes("casual") ||
        nameLower.includes("cow") ||
        nameLower.includes("female") ||
        nameLower.includes("male") ||
        nameLower.includes("ninja") ||
        nameLower.includes("viking") ||
        nameLower.includes("worker") ||
        nameLower.includes("knight") ||
        nameLower.includes("wizard") ||
        nameLower.includes("witch") ||
        nameLower.includes("elf") ||
        nameLower.includes("goblin") ||
        nameLower.includes("pug") ||
        nameLower.includes("doctor") ||
        nameLower.includes("pirate") ||
        nameLower.includes("zombie")
    ) {
        const charFiles = [
            "Cowboy_Female.glb",
            "BlueSoldier_Female.glb",
            "Suit_Male.glb",
            "Ninja_Male_Hair.glb",
            "Pirate_Female.glb",
            "Doctor_Female_Young.glb",
            "Soldier_Female.glb",
            "BlueSoldier_Male.glb",
            "Viking_Female.glb",
            "Zombie_Female.glb",
            "Worker_Female.glb",
            "Pirate_Male.glb",
            "Knight_Golden_Male.glb",
            "Casual3_Male.glb",
            "Casual_Bald.glb",
            "Suit_Female.glb",
            "Ninja_Sand.glb",
            "Casual_Male.glb",
            "Viking_Male.glb",
            "Casual2_Female.glb",
            "Casual_Female.glb",
            "Wizard.glb",
            "Kimono_Male.glb",
            "Doctor_Female_Old.glb",
            "Ninja_Male.glb",
            "Cowboy_Male.glb",
            "Doctor_Male_Old.glb",
            "Soldier_Male.glb",
            "Elf.glb",
            "tower_2.glb",
            "Doctor_Male_Young.glb",
            "Casual3_Female.glb",
            "Ninja_Female.glb",
            "Worker_Male.glb",
            "Zombie_Male.glb",
            "Knight_Male.glb",
            "Cow.glb",
            "Casual2_Male.glb",
            "Pug.glb",
            "Chef_Male.glb",
            "Chef_Female.glb",
            "Chef_Hat.glb",
            "Chef_Male-processed.glb",
            "OldClassy_Female.glb",
            "Goblin_Male.glb",
            "tower.glb",
            "Witch.glb",
            "Knight_Golden_Female.glb",
            "OldClassy_Male.glb",
            "Ninja_Sand_Female.glb",
            "Kimono_Female.glb",
        ];
        const matchedFile = charFiles.find(
            (f) =>
                f.toLowerCase() === nameLower ||
                nameLower.startsWith(f.toLowerCase().replace(".glb", "")),
        );
        if (matchedFile) {
            return `${API_BASE_URL}/assets/characters/npcs/${matchedFile}`;
        }
        return `${API_BASE_URL}/assets/characters/npcs/Soldier_Male.glb`;
    }

    if (nameLower.includes("tree")) {
        return `${API_BASE_URL}/assets/environment/trees/Pine_1.glb`;
    }
    return `${API_BASE_URL}/assets/environment/rocks/Rock_Medium_1.glb`;
}
