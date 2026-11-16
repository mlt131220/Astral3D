<template>
  <n-form label-placement="left" :label-width="90" label-align="left" size="small" class="px-2">
    <n-form-item :label="t('layout.sider.rendererConfig.Antialias')">
      <n-checkbox v-model:checked="rendererConfig.antialias"
                  @update:checked="updateAntialias"></n-checkbox>
    </n-form-item>

    <n-form-item :label="t('layout.sider.rendererConfig.Tone mapping')">
      <n-select v-model:value="rendererConfig.toneMapping" :options="toneMappingOptions"
                :render-option="renderToneMappingOption" @update:value="updateToneMapping"/>
      <EsInputNumber v-if="rendererConfig.toneMapping !== 0"
                     v-model:value="rendererConfig.toneMappingExposure" :min="0.00" size="tiny"
                     :decimal="2"
                     :show-button="false" class="ml-1" @change="updateToneMapping"/>
    </n-form-item>

    <n-form-item :label="t('layout.sider.rendererConfig.Frame rate limit')">
      <n-select v-model:value="rendererConfig.fps" :options="fpsOptions"
                :render-option="renderFpsOption" @update:value="updateFpsLimit"/>
    </n-form-item>
  </n-form>

  <n-divider class="!my-3"/>

  <n-collapse display-directive="show" :default-expanded-names="['shadow','csm']">
    <template #arrow>
      <n-icon>
        <CaretForwardOutline/>
      </n-icon>
    </template>

    <!--  阴影配置  -->
    <n-collapse-item :title="t('layout.sider.rendererConfig.shadows')" name="shadow">
      <n-form label-placement="left" :label-width="90" label-align="left" size="small" class="px-2">
        <n-form-item :label="t('other.Enable')">
          <n-checkbox v-model:checked="rendererConfig.shadow.enabled"
                      @update:checked="updateShadows"/>
        </n-form-item>

        <n-form-item :label="t('layout.sider.rendererConfig.Type')">
          <n-select v-model:value="rendererConfig.shadow.type" :options="shadowTypeOptions"
                    @update:value="updateShadows"/>
        </n-form-item>
      </n-form>
    </n-collapse-item>

    <!--  全局光影：即CSM  -->
    <n-collapse-item :title="t('layout.sider.rendererConfig.Global illumination')" name="csm">
      <SidebarRendererCSM class="px-2"/>
    </n-collapse-item>
  </n-collapse>
</template>

<script setup lang="ts">
import {reactive, h, VNode, onMounted} from 'vue';
import {SelectOption, NTooltip} from 'naive-ui';
import {CaretForwardOutline} from "@vicons/ionicons5";
import {App,FPS_OPTIONS,Utils} from '@astral3d/engine';
import {t} from "@/language";
import EsInputNumber from '@/components/es/EsInputNumber.vue';
import SidebarRendererCSM from "./renderer/Sidebar.Renderer.CSM.vue"

const rendererConfig = reactive(JSON.parse(JSON.stringify(App.project.getKey("renderer"))));

/* 渲染器设置项 */
// 阴影选项
const shadowTypeOptions = [
  {label: "Basic", value: 0},
  {label: "PCF", value: 1},
  {label: "VSM", value: 3}
];
// 色调映射选项
const toneMappingOptions = [
  {label: "No", value: 0},
  {label: "Linear", value: 1},
  {label: "Reinhard", value: 2},
  {label: "Cineon", value: 3},
  {label: "ACESFilmic", value: 4},
  {label: "AgX", value: 6},
  {label: "Neutral", value: 7},
];
// 帧率限制选项
const fpsOptions = [
  {label: t("layout.sider.rendererConfig.Low FPS"), value: FPS_OPTIONS.LOW},
  {label: t("layout.sider.rendererConfig.Medium FPS"), value: FPS_OPTIONS.MEDIUM},
  {label: t("layout.sider.rendererConfig.High FPS"), value: FPS_OPTIONS.HIGH},
  {label: t("layout.sider.rendererConfig.Ultra high FPS"), value: FPS_OPTIONS.ULTRA_HIGH},
  {label: t("layout.sider.rendererConfig.Unlimited"), value: FPS_OPTIONS.NO_UPPER_LIMIT},
];
const renderToneMappingOption = ({node, option}: { node: VNode; option: SelectOption }) => {
  return h(NTooltip, null, {
    trigger: () => node,
    default: () => option.label
  })
}
const renderFpsOption = ({node, option}: { node: VNode; option: SelectOption }) => {
  return h(NTooltip, null, {
    trigger: () => node,
    default: () => option.value ? `${option.value} FPS` : option.label,
  })
}

onMounted(() => {
  const viewerLoaded = () => {
    Utils.deepAssign(rendererConfig, App.project.getKey("renderer"));

    window.viewer.removeEventListener('loaded', viewerLoaded);
  }
  window.viewer.addEventListener('loaded', viewerLoaded);
})

function updateAntialias(){
  App.project.setKey("renderer.antialias",rendererConfig.antialias);
}

function updateShadows() {
  App.project.setKey("renderer.shadow.enabled",rendererConfig.shadow.enabled);
  App.project.setKey("renderer.shadow.type",rendererConfig.shadow.type);
}

function updateToneMapping() {
  App.project.setKey("renderer.toneMapping",rendererConfig.toneMapping);
  App.project.setKey("renderer.toneMappingExposure",rendererConfig.toneMappingExposure);
}

function updateFpsLimit(value:number){
  App.FPS = value;
}
</script>

<style scoped lang="less"></style>
