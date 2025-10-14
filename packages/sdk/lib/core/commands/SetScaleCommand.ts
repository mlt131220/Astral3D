import { Vector3 } from 'three';
import { Command } from './Command';
import { useDispatchSignal } from "#/hooks/useSignal";
import App from "../app/App";

/**
 * @param object THREE.Object3D
 * @param newValue THREE.Vector3
 * @param optionaloldValue THREE.Vector3
 * @constructor
 */
class SetScaleCommand extends Command {
	public object;
	public oldValue;
	public newValue;

	constructor(object, newValue, optionaloldValue) {
		super();

		this.type = 'SetScaleCommand';
		this.name = `Set scale`;
		this.updatable = true;

		this.object = object;

		if (object !== undefined && newValue !== undefined) {
			this.oldValue = object.scale.clone();
			this.newValue = newValue.clone();
		}

		if (optionaloldValue !== undefined) {
			this.oldValue = optionaloldValue.clone();
		}
	}

	execute() {
		this.object.scale.copy(this.newValue);
		this.object.updateMatrixWorld(true);
		useDispatchSignal("objectChanged", this.object);
	}

	undo() {
		this.object.scale.copy(this.oldValue);
		this.object.updateMatrixWorld(true);
		useDispatchSignal("objectChanged", this.object);
	}

	update(command) {
		this.newValue.copy(command.newValue);
	}

	toJSON() {
		const output = super.toJSON();

		output.objectUuid = this.object.uuid;
		output.oldValue = this.oldValue.toArray();
		output.newValue = this.newValue.toArray();

		return output;
	}

	fromJSON(json) {
		super.fromJSON(json);

		this.object = App.getObjectByUuid(json.objectUuid);
		this.oldValue = new Vector3().fromArray(json.oldValue);
		this.newValue = new Vector3().fromArray(json.newValue);
	}
}

export { SetScaleCommand };
