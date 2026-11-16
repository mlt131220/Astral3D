import { Command } from './Command';
import { useDispatchSignal } from "@/hooks";
import { getConfiguredPremultipliedAlpha, normalizeMaterialBlending } from "@/utils/scene/blending";
import App from "../app/App";

/**
 * @param object THREE.Object3D
 * @param attributeName string
 * @param newValue number, string, boolean or object
 * @constructor
 */
class SetMaterialValueCommand extends Command {
	public object;
	public material;
	public oldValue;
	public newValue;
	public attributeName;
	private materialSlot: number;

	constructor(object, attributeName, newValue, materialSlot = 0 ) {
		super();

		this.type = 'SetMaterialValueCommand';
		this.name = `Set material.${attributeName}`;
		this.updatable = true;

		this.object = object;
		this.materialSlot = materialSlot;
		this.material = App.getObjectMaterial( object, materialSlot );

		if (this.material) {
			this.oldValue = attributeName === "premultipliedAlpha"
				? getConfiguredPremultipliedAlpha(this.material)
				: this.material[attributeName];
		}
		this.newValue = newValue;

		this.attributeName = attributeName;
	}

	execute() {
		this.applyValue(this.newValue);
	}

	undo() {
		this.applyValue(this.oldValue);
	}

	private applyValue(value) {
		if (this.attributeName === "premultipliedAlpha") {
			normalizeMaterialBlending(this.material, value);
		} else {
			this.material[this.attributeName] = value;
			if (this.attributeName === "blending") normalizeMaterialBlending(this.material);
		}
		this.material.needsUpdate = true;
		useDispatchSignal("objectChanged",this.object);
		useDispatchSignal("materialChanged",this.material);
	}

	update( cmd ) {
		this.newValue = cmd.newValue;
	}

	toJSON() {
		const output = super.toJSON();

		output.objectUuid = this.object.uuid;
		output.attributeName = this.attributeName;
		output.materialSlot = this.materialSlot;
		output.oldValue = this.oldValue;
		output.newValue = this.newValue;

		return output;
	}

	fromJSON( json ) {
		super.fromJSON( json );

		this.attributeName = json.attributeName;
		this.oldValue = json.oldValue;
		this.newValue = json.newValue;
		this.object = App.getObjectByUuid( json.objectUuid );
		this.materialSlot = json.materialSlot ?? 0;
		this.material = App.getObjectMaterial(this.object, this.materialSlot);
	}

}

export { SetMaterialValueCommand };
