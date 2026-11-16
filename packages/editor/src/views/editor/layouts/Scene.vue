<script lang="ts" setup>
import {ref, inject, Ref} from 'vue';
import {Vector2} from 'three';
import {App, Loader} from "@astral3d/engine";
import {useDragStore} from "@/store/modules/drag";
import {useGlobalConfigStore} from '@/store/modules/globalConfig';
import Config from "@/utils/storage/config";
import Drawing from "@/components/drawing/Drawing.vue";
import Viewport from "./viewport/Viewport.vue";
import ExtraPane from "@/views/editor/components/extraPane/ExtraPane.vue";

const globalConfigStore = useGlobalConfigStore();

const drawingInfo = inject("drawingInfo") as Ref<IDrawing>;
const viewerContainerRef = ref();
const viewportRef = ref();
const drawingRef = ref();

// 场景界面与扩展面板分割大小
const splitSize = ref(Config.getKey("sceneSplitSize") || 0.8);

/** 鼠标拖拽事件相关 **/
const dragStore = useDragStore();

function sceneDrop(event) {
  event.preventDefault();

  // 设置鼠标释放时的区域屏幕坐标
  dragStore.endPosition = new Vector2(event.layerX, event.layerY);

  if (event.target) {
    if (viewportRef.value?.$el?.contains(event.target)) {
      dragStore.endArea = "Scene";
    } else if (drawingRef.value?.$el?.contains(event.target)) {
      dragStore.endArea = "Drawing";
    } else {
      dragStore.endArea = "";
    }
  }

  const dt = event.dataTransfer as DataTransfer;

  //拖拽大纲视图
  if (dt.types[0] === 'text/plain') return;

  if (dt.items) {
    //支持文件夹
    Loader.loadItemList(dt.items);
  } else {
    Loader.loadFiles(dt.files, undefined).catch(error => App.log.error("模型导入失败：" + String(error)));
  }
}

function sceneDragOver(event) {
  event.preventDefault();
  (event.dataTransfer as DataTransfer).dropEffect = 'copy';
}

function sceneDragEnter() {
  dragStore.setActionTarget("addToScene");
}

function sceneDragLeave(e) {
  // 确保移出了场景区+图纸区
  if (e.fromElement && viewerContainerRef.value.$el.contains(e.fromElement)) return;

  dragStore.setActionTarget("");
}

/** 鼠标拖拽事件相关 End **/

/**
 * 拖拽分割大小变换
 * @param {number} value
 */
function handleSplitSizeUpdate(value: number) {
  Config.setKey("sceneSplitSize", value);
}
</script>

<template>
  <n-spin ref="viewerContainerRef" :show="globalConfigStore.loading" @drop="sceneDrop" @dragover="sceneDragOver"
          @dragenter="sceneDragEnter" @dragleave="sceneDragLeave">
    <n-split direction="vertical" :max="1" :min="0" :default-size="splitSize" @update:size="handleSplitSizeUpdate">
      <template #1>
        <n-split direction="horizontal" :max="0.85" :min="0.15" :default-size="splitSize"
                 :pane1-style="{ display: drawingInfo?.isUploaded ? 'flex' : 'none' }"
                 :resize-trigger-size="drawingInfo?.isUploaded ? 3 : 0">
          <template #1 v-if="drawingInfo?.isUploaded">
            <Drawing ref="drawingRef"/>
          </template>
          <template #2>
            <Viewport ref="viewportRef"/>
          </template>
        </n-split>
      </template>

      <template #2>
        <ExtraPane/>
      </template>
    </n-split>

    <template #description>{{ globalConfigStore.loadingText }}</template>
  </n-spin>
</template>

<style lang="less" scoped>
.n-spin-container {
  width: 100%;
  height: 100%;
  overflow: hidden;

  :deep(.n-spin-content) {
    width: 100%;
    height: 100%;

    .n-split {
      &-pane-1, &-pane-2 {
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
      }
    }

    .n-descriptions {
      &-header {
        margin-bottom: 0;
      }
    }
  }
}
</style>
