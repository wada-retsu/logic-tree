<template>
  <g :transform="transform" >
    <!-- +ボタンをノードの真下に表示 -->
    <foreignObject
      :x="-(nodeWidth / 2)"
      :y="nodeHeight / 2 - 3"
      :width="nodeWidth"
      height="16"
    >
      <button @click.stop="addChild" class="custom-button">+</button>
    </foreignObject>
    <!-- -ボタンをノードの真上に表示 -->
    <foreignObject
      v-if="node.parentId"
      :x="-(nodeWidth / 2) - 0.3"
      :y="-(nodeHeight / 2) - 13"
      :width="nodeWidth"
      height="16"
    >
      <button @click.stop="deleteNode" class="custom-button">-</button>
    </foreignObject>
    <!-- ノードの四角形 -->
    <rect
      :x="-(nodeWidth / 2)"
      :y="-(nodeHeight / 2)"
      :width="nodeWidth"
      :height="nodeHeight"
      :fill="node.color || '#D8DCDC'"
      @click="handleNodeClick"
    />

    <!-- テキスト部分 -->
    <text
      v-if="!isEditing"
      :x="0"
      :y="getTextY"
      text-anchor="middle"
      dominant-baseline="central"
      @click="editNodeLabel"
      ref="textElement"
    >
    <tspan 
      v-for="(line, index) in formatLabel(node.label).split('\n')" 
      :x="0" 
      :dy="index === 0 ? 0 : '1.2em'" 
      :key="index"
    >
      {{ line }}
    </tspan>
    </text>

    <!-- 編集モードのinput -->
    <foreignObject v-if="isEditing" :x="-(nodeWidth / 2)" :y="-20" :width="nodeWidth" :height="40">
      <input
        type="text"
        v-model="editableLabel"
        @blur="saveLabel"
        @keydown.enter="saveLabel"
      />
    </foreignObject>
    
    <!-- カラーメニュー（ノードの右側に表示） -->
    <foreignObject v-if="isColorMenuVisible" :x="nodeWidth / 2 -130" :y="-15" width="140" height="30">
      <div class="color-menu">
        <div
          v-for="(color, index) in colors"
          :key="index"
          class="color-box"
          :style="{ backgroundColor: color }"
          @click.stop="changeColor(color)"
        ></div>
      </div>
    </foreignObject>
    <!-- 入れ替えモードボタン -->
    <foreignObject
      :x="nodeWidth / 2 - 30"
      :y="-nodeHeight / 2 - 20"
      :width="70"
      :height="70"
    >
    <button 
      @click.stop="toggleSwapMode" 
      class="swap-button"
      :class="{ 'swap-button-large': isSwapMode && selectedNode && selectedNode.id !== node.id }"
    >
      <span class="icon"></span>
    </button>
    </foreignObject>
  </g>
</template>

<script>
export default {
  name: 'TreeNode',
  props: {
    node: {
      type: Object,
      required: true,
    },
    x: Number,
    y: Number,
    isSelected: Boolean,
    isSwapMode: Boolean, // 入れ替えモード中かどうか
    selectedNode: Object, // 入れ替え元（最初に選択したノード）
    saveHistory: {
      type: Function,
      required: false,
      default: () => {}, // 空の関数をデフォルトにする
    },
  },
  emits: ["toggle-swap-mode", "select-for-swap"],
  data() {
    return {
      editableLabel: this.node.label, // 編集中のラベル
      nodeWidth: 110, // 初期幅（最低幅）
      nodeHeight: 40, // 高さ
      isColorMenuVisible: false,
      isEditing: false,
      colors: ["#36ABB5", "#B4ACD0", "#D8DCDC", "#EB6D80", "#F29600"], // 5つの色
    };
  },
  watch: {
    'node.label': function () {
      this.$nextTick(() => {
        this.updateNodeDimensions();
      });
    },
  },
  computed: {
    transform() {
      return `translate(${this.x}, ${this.y})`;
    },
    getTextY() {
      const lineCount = this.getLineCount(this.node.label);
      return -(lineCount - 1) * 10;
    },
  },
  methods: {
    selectNode() {
      this.$emit('select', this.node);
    },
    startEditing() {
      this.isEditing = true;
      this.editableLabel = this.node.label;
    },
    saveLabel() {
      this.isEditing = false;
      if (this.editableLabel !== this.node.label) {
        this.$emit('update-label', { id: this.node.id, label: this.editableLabel });
      }
      this.updateNodeDimensions(); // 保存時に幅を更新
    },
    addChild() {
      this.$emit('add-child', this.node);
    },
    deleteNode() {
      this.$emit('delete-node', this.node); // 削除イベントを親に通知
    },
    updateNodeDimensions() {
      this.$nextTick(() => {
        const textElement = this.$refs.textElement;
        if (textElement) {
          setTimeout(() => {
            const textHeight = textElement.getBBox().height;
            // ノードの高さをテキストの高さ + 余白20pxで調整
            this.nodeHeight = textHeight + 20;
            // ノードの中心がずれないように調整
            this.nodeYOffset = -(this.nodeHeight / 2);
          }, 10);
        }
      });
    },
    formatLabel(label) {
      const chunkSize = 7;
      const regex = new RegExp(`.{1,${chunkSize}}`, 'g');
      return label.match(regex).join('\n');
    },
    getLineCount(label) {
      return this.formatLabel(label).split('\n').length;
    },
    editNodeLabel() {
      const newLabel = prompt('ノード名を入力してください:', this.node.label);
      if (newLabel !== null && newLabel.trim() !== '') {
        this.$emit('update-label', { id: this.node.id, label: newLabel });
      }
    },
    toggleColorMenu(event) {
      event.stopPropagation();

      if (!this.node || typeof this.node.y === "undefined") {
        console.warn("toggleColorMenu: ノードが未定義のため処理を中断", this.node);
        return;
      }

      // カラーメニューの状態を切り替える
      this.isColorMenuVisible = !this.isColorMenuVisible;

      if (this.isColorMenuVisible) {
        this.$nextTick(() => {
          setTimeout(() => {
            this.updateColorMenuPosition(event);
          }, 0);
        });

        document.addEventListener("click", this.hideColorMenu);
      } else {
        document.removeEventListener("click", this.hideColorMenu);
      }
    },
    updateColorMenuPosition(event) {
      if (!event.target) {
        console.warn("updateColorMenuPosition: event.target が `null`");
        return;
      }

      const rect = event.target.getBoundingClientRect();
      this.colorMenuPosition = {
        x: rect.right + 10, // ノードの右側に表示
        y: rect.top + window.scrollY - 5, // スクロール対応
      };
    },
    hideColorMenu() {
      this.isColorMenuVisible = false;
      document.removeEventListener("click", this.hideColorMenu);
    },
    changeColor(color) {
      if (typeof this.saveHistory === "function") {
        this.saveHistory();
      }
      this.$emit("update-color", { id: this.node.id, color });
      this.hideColorMenu();
    },
    toggleSwapMode() {
      this.$emit("toggle-swap-mode", this.node); // 親コンポーネントで全ノードに適用
    },
    selectForSwap() {
      if (this.isSwapMode && this.selectedNode?.id !== this.node.id) {
        this.$emit("select-for-swap", this.node);
        this.isSwapMode = false; // 入れ替え完了後、自動でモード解除
      }
    },
    handleNodeClick(event) {
      if (this.isSwapMode) {
        this.selectForSwap();
      } else {
        this.toggleColorMenu(event);
      }
    },
  },
  mounted() {
    this.updateNodeDimensions();
  },
  updated() {
    this.updateNodeDimensions();
  },
};
</script>

<style scoped>
rect {
  cursor: pointer;
}
.custom-button {
  color: rgb(155, 155, 155);
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  background-color: #D8DCDC;
  border-radius: 4px; /* 角丸を少しだけ追加 */
  width: 100%;
  height: 100%;
  display: flex; /* フレックスボックスを使用して配置 */
  justify-content: center; /* 水平方向中央揃え */
  align-items: center; /* 垂直方向中央揃え */
  text-align: center; /* テキストを中央揃え */
}
.custom-button:hover {
  background-color: #C8C9CA; /* ホバー時の色 */
  border-color: #D8DCDC;
}
input {
  width: 100%;
  padding: 5px;
  font-size: 14px;
}
.color-menu {
  position: absolute;
  display: flex;
  gap: 5px;
  background: white;
  border: 1px solid #ccc;
  padding: 5px;
  border-radius: 5px;
  z-index: 9999;
}
.color-box {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  border: 1px solid white;
}
.swap-button {
  background-color: #D8DCDC;
  border: solid 1px;
  border-color: white;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.swap-button-large {
  transform: scale(1.2,1.2);
}
.swap-button:hover {
  background-color: #D8DCDC;
}
.icon:before{
  color: rgb(113, 113, 113);
	font-style: normal;
	font-variant: normal;
	text-rendering: auto;
	-webkit-font-smoothing: antialiased;
	font-family: "Font Awesome 5 Free"; 
	font-weight: 900; /* アイコン種類に対応したFont-Weight */
	content: '\f2f1'; /* アイコンのUnicode */
}
</style>