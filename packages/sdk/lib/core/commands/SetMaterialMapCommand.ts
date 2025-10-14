import { Command } from './Command';
import { ObjectLoader } from '../loader/ObjectLoader';
import { useDispatchSignal } from "#/hooks";
import App from "../app/App";

/**
 * @param object THREE.Object3D
 * @param mapName string
 * @param newMap THREE.Texture
 * @constructor
 */
class SetMaterialMapCommand extends Command {
	public object;
	private material;
	private oldMap;
	private newMap;
	private mapName;

	constructor(object, mapName, newMap, materialSlot) {
		super();

		this.type = 'SetMaterialMapCommand';
		this.name = `Set material.${mapName}`;

		this.object = object;
		this.material = App.getObjectMaterial(object, materialSlot);

		this.oldMap = (object !== undefined) ? this.material[mapName] : undefined;
		this.newMap = newMap;

		this.mapName = mapName;
	}

	execute() {
		if (this.oldMap !== null && this.oldMap !== undefined) this.oldMap.dispose();

		this.material[this.mapName] = this.newMap;
		this.material.needsUpdate = true;

		useDispatchSignal("materialChanged", this.material)
	}

	undo() {
		this.material[this.mapName] = this.oldMap;
		this.material.needsUpdate = true;

		useDispatchSignal("materialChanged", this.material)
	}

	toJSON() {
		const output = super.toJSON();

		output.objectUuid = this.object.uuid;
		output.mapName = this.mapName;
		output.newMap = serializeMap(this.newMap);
		output.oldMap = serializeMap(this.oldMap);

		return output;

		// serializes a map (THREE.Texture)

		function serializeMap(map) {

			if (map === null || map === undefined) return null;

			const meta = {
				geometries: {},
				materials: {},
				textures: {},
				images: {}
			};

			const json = map.toJSON(meta);
			const images = extractFromCache(meta.images);
			if (images.length > 0) json.images = images;
			json.sourceFile = map.sourceFile;

			return json;

		}

		// Note: The function 'extractFromCache' is copied from Object3D.toJSON()

		// extract data from the cache hash
		// remove metadata on each item
		// and return as array
		function extractFromCache(cache) {

			const values: any = [];
			for (const key in cache) {

				const data = cache[key];
				delete data.metadata;
				values.push(data);

			}

			return values;
		}
	}

	fromJSON(json) {
		super.fromJSON(json);

		this.object = App.getObjectByUuid(json.objectUuid);
		this.mapName = json.mapName;
		this.oldMap = parseTexture(json.oldMap);
		this.newMap = parseTexture(json.newMap);

		function parseTexture(json) {
			let map;
			if (json !== null) {
				const loader = new ObjectLoader();
				const images = loader.parseImages(json.images, () => { });
				const textures = loader.parseTextures([json], images);
				map = textures[json.uuid];
				map.sourceFile = json.sourceFile;
			}

			return map;
		}
	}
}

export { SetMaterialMapCommand };
