import { Euler } from 'three';
import { Command } from './Command';
import { useDispatchSignal } from "#/hooks";
import App from "../app/App";

/**
 * @param object THREE.Object3D
 * @param newValue THREE.Euler
 * @param optionaloldValue THREE.Euler
 * @constructor
 */
class SetRotationCommand extends Command {
	public object;
	public oldValue;
	public newValue;

	constructor(object, newValue, optionaloldValue) {
		super();

		this.type = 'SetRotationCommand';
		this.name = `Set rotation`;
		this.updatable = true;

		this.object = object;

		if (object !== undefined && newValue !== undefined) {
			this.oldValue = object.rotation.clone();
			this.newValue = newValue.clone();
		}

		if (optionaloldValue !== undefined) {
			this.oldValue = optionaloldValue.clone();
		}
	}

	execute() {
		this.object.rotation.copy(this.newValue);
		this.object.updateMatrixWorld(true);
		useDispatchSignal("objectChanged", this.object);
	}

	undo() {
		this.object.rotation.copy(this.oldValue);
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
		this.oldValue = new Euler().fromArray(json.oldValue);
		this.newValue = new Euler().fromArray(json.newValue);
	}
}

export { SetRotationCommand };
