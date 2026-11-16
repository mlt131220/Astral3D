<script lang="ts" setup>
import {ref, onMounted, onUnmounted} from "vue";
import {Mesh,Material} from "three";
import {App,Hooks,Utils,SetMaterialValueCommand} from "@astral3d/engine";
import {t} from "@/language";
import EsInputNumber from '@/components/es/EsInputNumber.vue';
import EsKeyFrame from "@/components/es/EsKeyFrame.vue";

const props = withDefaults(defineProps<{
  property: string,
  name: string,
  range?: Array<number>,
  decimal?: number,
  step?: number,
  unit?: string,
  keyframe?: boolean
}>(), {
  property: "",
  name: "",
  //@ts-ignore
  range: [-Infinity, Infinity],
  decimal: 0,
  keyframe: true
})

const show = ref(false);
const numberValue = ref();
let object: Mesh;
let material: Material;
let currentMaterialSlot = 0;

onMounted(() => {
  Hooks.useAddSignal("objectSelected", handleObjectSelected);
  Hooks.useAddSignal("materialChanged", update);
  Hooks.useAddSignal("materialCurrentSlotChange", currentSlotChange);
})

onUnmounted(() => {
  Hooks.useRemoveSignal("objectSelected", handleObjectSelected);
  Hooks.useRemoveSignal("materialChanged", update);
  Hooks.useRemoveSignal("materialCurrentSlotChange", currentSlotChange)
})

function currentSlotChange(currentSlot) {
  currentMaterialSlot = currentSlot;
  update();
}

function handleObjectSelected(selected) {
  object = selected;
  update();
}

const update = Utils.throttle(function() {
  if (!object || !object.material) return;

  material = App.getObjectMaterial(object, currentMaterialSlot);

  if (props.property in material) {
    numberValue.value = material[props.property];
    show.value = true;
  } else {
    show.value = false;
  }
},100)

function onChange() {
  if (material[props.property] !== numberValue.value) {
    App.execute(new SetMaterialValueCommand(object, props.property, numberValue.value, currentMaterialSlot));
  }
}
</script>

<template>
    <div id="sider-scene-material-color-property" v-if="show">
        <EsKeyFrame v-if="keyframe" :label="t(`layout.sider.material.${name}`)" :attr="`material.${property}`" />
        <span v-else>{{ t(`layout.sider.material.${name}`) }}</span>
        <div>
            <EsInputNumber v-model:value="numberValue" size="tiny" :show-button="false" :min="range[0]" :max="range[1]"
                :decimal="decimal" :step="step" @change="onChange" />
            <span v-if="unit">{{ unit }}</span>
        </div>
    </div>
</template>

<style lang="less" scoped>
#sider-scene-material-color-property {
  display: flex;
  justify-content: space-between;
  margin: 10px 0;
  align-items: center;

  & > span {
     min-width:80px;
  }

  & > div {
    width: 150px;
    color: rgb(165, 164, 164);
  }
}
</style>
