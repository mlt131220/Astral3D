import { Vector3 } from 'three';
import { Command } from './Command';
import { useDispatchSignal } from '#/hooks';
import App from "../app/App";

/**
 * @param object THREE.Object3D
 * @param newValue THREE.Vector3
 * @param optionaloldValue THREE.Vector3
 * @constructor
 */
class SetPositionCommand extends Command {
	public object;
	public oldValue;
	public newValue;

	constructor(object, newValue, optionaloldValue?) {
		super();

		this.type = 'SetPositionCommand';
		this.name = `Set position`;
		this.updatable = true;
		this.object = object;
		if (object !== undefined && newValue !== undefined) {
			this.oldValue = object.position.clone();
			this.newValue = newValue.clone();
		}

		if (optionaloldValue !== undefined) {
			this.oldValue = optionaloldValue.clone();
		}
	}

	execute() {
		this.object.position.copy(this.newValue);
		this.object.updateMatrixWorld(true);
		useDispatchSignal("objectChanged", this.object)
	}

	undo() {
		this.object.position.copy(this.oldValue);
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

export { SetPositionCommand };
