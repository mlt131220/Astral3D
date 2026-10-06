<template>
  <n-form label-placement="left" :label-width="90" label-align="left" size="small">
    <!-- background -->
    <n-form-item :label="t('layout.sider.sceneConfig.Background')">
      <template class="w-full flex items-center justify-between">
        <n-select v-model:value="backgroundType" @update:value="onBackgroundChanged"
                  :options="[{ label: '', value: 'None' }, { label: 'Color', value: 'Color' }, { label: 'Texture', value: 'Texture' }, { label: 'Equirect', value: 'Equirectangular' }]"/>

        <n-color-picker v-if="backgroundType === 'Color'" v-model:value="backgroundColor" :show-alpha="false" :render-label="() => ''"
                        :modes="['hex']" @update:value="onBackgroundChanged" size="small"  class="ml-5px w-36px"/>

        <EsTexture v-else-if="backgroundType === 'Texture'" v-model:texture="backgroundTexture"
                   @change="onBackgroundChanged" width="26px" height="26px" class="ml-5px"/>

        <EsTexture v-else-if="backgroundType === 'Equirectangular'" v-model:texture="backgroundEquirectangularTexture"
                   @change="onBackgroundChanged" width="26px" height="26px" class="ml-5px" />
      </template>
    </n-form-item>
    <div v-if="backgroundType === 'Equirectangular'" class="flex justify-start items-center pl-90px pb-1">
      <EsInputNumber v-model:value="backgroundBlurriness" class="w-30% ml-5px"
                     size="tiny" :show-button="false" :min="0" :max="1" :decimal="2"
                     @change="onBackgroundChanged" />
      <EsInputNumber v-model:value="backgroundIntensity" class="w-30% ml-5px"
                     size="tiny" :show-button="false" :min="0" :max="Infinity" :decimal="2"
                     @change="onBackgroundChanged" />
      <EsInputNumber v-model:value="backgroundRotation" class="w-30% ml-5px"
                     size="tiny" :show-button="false" :min="-180" :max="180" :decimal="1" unit="°"
                     @change="onBackgroundChanged" />
    </div>

    <!-- environment -->
    <n-form-item :label="t('layout.sider.sceneConfig.Environment')">
      <n-select v-model:value="environmentSelect" @update:value="onEnvironmentChanged"
                :options="[{ label: '', value: 'None' }, { label: 'Equirect', value: 'Equirectangular' }, { label: 'Modelviewer', value: 'ModelViewer' }]"/>

      <EsTexture v-if="environmentSelect === 'Equirectangular'" v-model:texture="environmentTexture"
                 @change="onEnvironmentChanged" width="26px" height="26px" class="ml-5px"/>
    </n-form-item>

    <!-- 网格 -->
    <n-form-item :label="t('layout.sider.sceneConfig.Grid')">
      <n-switch size="small" v-model:value="grid"
                @update:value="Hooks.useDispatchSignal('showGridChanged', grid)"/>
    </n-form-item>
    <!-- 辅助 -->
    <n-form-item :label="t('layout.sider.sceneConfig.Helpers')">
      <n-switch size="small" v-model:value="helpers"
                @update:value="handleShowHelpers"/>
    </n-form-item>
  </n-form>
</template>

<script setup lang="ts">
import {nextTick, onBeforeUnmount, onMounted, ref, toRaw} from "vue";
import {Color,Texture,CubeTexture,EquirectangularReflectionMapping,MathUtils} from "three";
import {App,Hooks} from "@astral3d/engine";
import {t} from "@/language";
import EsInputNumber from "@/components/es/EsInputNumber.vue";
import EsTexture from "@/components/es/EsTexture.vue";

//背景
const backgroundType = ref("Equirectangular");
const backgroundColor = ref<string | number>('#000000');
const backgroundTexture = ref<Color | Texture | CubeTexture | null>(null);
const backgroundEquirectangularTexture = ref();
const backgroundBlurriness = ref(0);
const backgroundIntensity = ref(1);
const backgroundRotation = ref(0);
//环境
const environmentSelect = ref("None");
const environmentTexture = ref()
// 网格
const grid = ref(true);
// 辅助
const helpers = ref(true);

onMounted(async () => {
  await nextTick();
  refreshUI();

  Hooks.useAddSignal("sceneCleared", refreshUI);
  Hooks.useAddSignal("sceneGraphChanged", refreshUI);
})

onBeforeUnmount(()=>{
  Hooks.useRemoveSignal("sceneCleared", refreshUI);
  Hooks.useRemoveSignal("sceneGraphChanged", refreshUI);
})

// 更新树及背景/环境
function refreshUI() {
  const scene = App.scene;

  //背景
  if (scene.background) {
    if ((<Color>scene.background).isColor) {
      backgroundType.value = 'Color';
      backgroundColor.value = "#" + (<Color>scene.background).getHexString();
    } else if ((<Texture>scene.background).isTexture) {
      if ((<Texture>scene.background).mapping === EquirectangularReflectionMapping) {
        backgroundEquirectangularTexture.value = scene.background;
        backgroundBlurriness.value = scene.backgroundBlurriness;
        backgroundIntensity.value = scene.backgroundIntensity;
        backgroundRotation.value = scene.backgroundRotation.y * MathUtils.RAD2DEG;

        backgroundType.value = 'Equirectangular';
      } else {
        backgroundTexture.value = scene.background;

        backgroundType.value = 'Texture';
      }
    }
  } else {
    backgroundType.value = 'None';
  }

  //环境
  if (scene.environment) {
    if (scene.environment.mapping === EquirectangularReflectionMapping) {
      environmentTexture.value = scene.environment;
      environmentSelect.value = "Equirectangular";
    }else if(scene.environment.isRenderTargetTexture) {
      environmentSelect.value = 'ModelViewer';
    }
  } else {
    environmentSelect.value = "None";
  }
}

//background Change Event
function onBackgroundChanged() {
  Hooks.useDispatchSignal(
      "sceneBackgroundChanged",
      toRaw(backgroundType.value),
      toRaw(backgroundColor.value),
      toRaw(backgroundTexture.value),
      toRaw(backgroundEquirectangularTexture.value),
      toRaw(backgroundBlurriness.value),
      toRaw(backgroundIntensity.value),
      toRaw(backgroundRotation.value),
  );
}

//environment Change Event
function onEnvironmentChanged() {
  Hooks.useDispatchSignal("sceneEnvironmentChanged", toRaw(environmentSelect.value), toRaw(environmentTexture.value));
}

function handleShowHelpers(){
  window.viewer.edit = {
    enabled: helpers.value,
    helpers: true,
    gizmo: true
  }

  window.viewer.render();
}
</script>