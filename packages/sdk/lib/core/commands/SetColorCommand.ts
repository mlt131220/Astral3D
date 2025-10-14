import { Command } from './Command';
import { useDispatchSignal } from "#/hooks/useSignal";
import App from "../app/App";

/**
 * @param object THREE.Object3D
 * @param attributeName string
 * @param newValue integer representing a hex color value
 * @constructor
 */
class SetColorCommand extends Command {
	public object;
	public attributeName;
	public oldValue;
	public newValue;

	constructor(object, attributeName, newValue) {
		super();
		this.type = 'SetColorCommand';
		this.name = `Set ${attributeName}`;
		this.updatable = true;

		this.object = object;
		this.attributeName = attributeName;
		this.oldValue = (object !== undefined) ? this.object[this.attributeName].getStyle() : undefined;
		this.newValue = newValue;
	}

	execute() {
		this.object[this.attributeName].setStyle(this.newValue);
		useDispatchSignal("objectChanged", this.object);
	}

	undo() {
		this.object[this.attributeName].setStyle(this.oldValue);
		useDispatchSignal("objectChanged", this.object);
	}

	update(cmd) {
		this.newValue = cmd.newValue;
	}

	toJSON() {
		const output = super.toJSON();

		output.objectUuid = this.object.uuid;
		output.attributeName = this.attributeName;
		output.oldValue = this.oldValue;
		output.newValue = this.newValue;

		return output;
	}

	fromJSON(json) {
		super.fromJSON(json);

		this.object = App.getObjectByUuid(json.objectUuid);
		this.attributeName = json.attributeName;
		this.oldValue = json.oldValue;
		this.newValue = json.newValue;
	}

}

export { SetColorCommand };
