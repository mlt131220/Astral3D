import { Command } from './Command';
import { useDispatchSignal } from "#/hooks";
import App from "../app/App";

/**
 * @param object THREE.Object3D
 * @param attributeName string
 * @param newMinValue number
 * @param newMaxValue number
 * @constructor
 */
class SetMaterialRangeCommand extends Command {
	public object;
	public material;
	public oldValue;
	public newValue;
	public attributeName;

	constructor(object, attributeName, newMinValue, newMaxValue, materialSlot) {
		super();

		this.type = 'SetMaterialRangeCommand';
		this.name = `Set material.${attributeName}`;
		this.updatable = true;

		this.object = object;
		this.material = App.getObjectMaterial(object, materialSlot);

		this.oldValue = (this.material !== undefined && this.material[attributeName] !== undefined) ? [...this.material[attributeName]] : undefined;
		this.newValue = [newMinValue, newMaxValue];

		this.attributeName = attributeName;
	}

	execute() {
		this.material[this.attributeName] = [...this.newValue];
		this.material.needsUpdate = true;

		useDispatchSignal("objectChanged", this.object);
		useDispatchSignal("materialChanged", this.material);
	}

	undo() {
		this.material[this.attributeName] = [...this.oldValue];
		this.material.needsUpdate = true;

		useDispatchSignal("objectChanged", this.object);
		useDispatchSignal("materialChanged", this.material);
	}

	update(cmd) {
		this.newValue = [...cmd.newValue];
	}

	toJSON() {
		const output = super.toJSON();

		output.objectUuid = this.object.uuid;
		output.attributeName = this.attributeName;
		output.oldValue = [...this.oldValue];
		output.newValue = [...this.newValue];

		return output;
	}

	fromJSON(json) {
		super.fromJSON(json);

		this.attributeName = json.attributeName;
		this.oldValue = [...json.oldValue];
		this.newValue = [...json.newValue];
		this.object = App.getObjectByUuid(json.objectUuid);
	}
}

export { SetMaterialRangeCommand };
