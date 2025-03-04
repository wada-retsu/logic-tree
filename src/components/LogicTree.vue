<template>
  <div class="logic-tree" @contextmenu.prevent>
    <svg
      :width="svgWidth"
      :height="svgHeight"
      ref="svgElement"
      @mousedown="startDrag"
      @mousemove="onDrag"
      @mouseup="endDrag"
      @mouseleave="endDrag"
    >
      <!-- ツリー全体を移動・ズームできるようにする -->
      <g :transform="'translate(' + offsetX + ', ' + offsetY + ') scale(' + scale + ')'">
        
        <!-- <g v-for="(level, index) in levels" :key="'bg-' + index">
          <rect
            :x="layoutDirection === 'vertical'
              ? getTreeMinX() - padding - 50
              : getLevelPosition(index) - nodeSpacingX / 2 + 10"
            :y="layoutDirection === 'vertical'
              ? getLevelPosition(index) - nodeSpacingY / 2 + 10
              : getTreeMinY() - padding - 50"
            :width="layoutDirection === 'vertical'
              ? getTreeWidth() + padding * 2 + 100
              : nodeSpacingX - 15"
            :height="layoutDirection === 'vertical'
              ? nodeSpacingY -15
              : getTreeHeight() + padding * 2 + 100"
            fill="lightgray"
            opacity="0.3"
          />
          <text
            :x="layoutDirection === 'vertical'
                ? getTreeMaxX() + padding + 20
                : getLevelPosition(index) - nodeSpacingX - 10"
            :y="layoutDirection === 'vertical'
                ? getLevelPosition(index) + (nodeSpacingY / 2) - 60
                : getTreeMaxY() + padding + 80"
            text-anchor="start"
            fill="black"
            font-size="16"
            font-weight="bold"
            @dblclick="editLevelName(index)"
          >
            <tspan
              v-for="(line, i) in splitText(levels[index]?.name || '')"
              :key="i"
              :x="layoutDirection === 'vertical'
                  ? getTreeMinX() + getTreeWidth() + padding + 60
                  : getLevelPosition(index) - nodeSpacingX + 70"
              :dy="i === 0 ? '0' : '1.2em'"
            >
              {{ line }}
            </tspan>
          </text>
        </g> -->

        <!-- ノード間の線 -->
        <line
          v-for="node in nodes"
          :key="'line-' + node.id"
          :x1="getNode(node.parentId)?.x || node.x || 0"
          :y1="getNode(node.parentId)?.y || node.y || 0"
          :x2="node.x || 0"
          :y2="node.y || 0"
          stroke="grey"
          stroke-width="2"
        />
        <!-- ノードを描画 -->
        <TreeNode
          v-for="node in nodes"
          :key="node.id"
          :node="node"
          :x="node.x"
          :y="node.y"
          :isSelected="node === selectedNode"
          :isEditing="node.id === editingNodeId"
          :saveHistory="saveHistory"
          @select="selectNode"
          @add-child="addChildNode"
          @update-label="updateNodeLabel"
          @delete-node="deleteNode"
          @update-color="updateNodeColor"
        />
      </g>
    </svg>
  </div>
</template>

<script>
import TreeNode from './TreeNode.vue';

export default {
  components: { TreeNode },
  props: ['nodes', 'selectedNode', 'editingNodeId', 'layoutDirection', 'saveHistory'],
  emits: ['select-node', 'update-tree', 'update-label'],
  data() {
    return {
      globalNodeCounter: 1,
      baseY: 50,
      nodeSpacingY: 120,
      nodeSpacingX: 120,
      svgWidth: 0,
      svgHeight: window.innerHeight,
      scale: 1, // 現在のスケール値
      minScale: 0.5, // 最小スケール
      maxScale: 2, // 最大スケール
      offsetX: 0, // オフセットX
      offsetY: 0, // オフセットY
      padding: 20, // 余白 (px)
      isDragging: false, // ドラッグ中フラグ
      dragStart: { x: 0, y: 0 }, // ドラッグ開始位置
      levels: [{ id: 1, name: 'レベル 1' }] // 🔹 階層をオブジェクト形式にする
    };
  },
  mounted() {
    this.updateSVGWidth();
    window.addEventListener('resize', this.updateSVGWidth);
    this.$refs.svgElement.addEventListener('wheel', this.handleZoom); // マウスホイールを監視
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.updateSVGWidth);
    this.$refs.svgElement.removeEventListener('wheel', this.handleZoom);
  },
  methods: {
    calculateRequiredWidth(node, nodes) {
      if (!node) return 0;
      const children = nodes.filter(n => n.parentId === node.id);
      if (children.length === 0) {
        return this.nodeSpacingX;
      }
      return children.reduce((total, child) => total + this.calculateRequiredWidth(child, nodes), 0);
    },
    calculateNodePositions(node, nodes, primary, depth) {
      if (!node) return;
      const children = nodes.filter(n => n.parentId === node.id);
      if (children.length === 0) {
        if (this.layoutDirection === 'vertical') {
          node.x = primary;
          node.y = this.baseY + depth * this.nodeSpacingY;
        } else {
          node.x = this.baseY + depth * this.nodeSpacingX;
          node.y = primary;
        }
        return;
      }

      const totalWidth = children.reduce(
        (total, child) => total + this.calculateRequiredWidth(child, nodes),
        0
      );

      let currentPrimary = primary - totalWidth / 2;
      children.forEach(child => {
        const childWidth = this.calculateRequiredWidth(child, nodes);
        this.calculateNodePositions(child, nodes, currentPrimary + childWidth / 2, depth + 1);
        currentPrimary += childWidth;
      });

      if (this.layoutDirection === 'vertical') {
        node.x = primary;
        node.y = this.baseY + depth * this.nodeSpacingY;
      } else {
        node.x = this.baseY + depth * this.nodeSpacingX;
        node.y = primary;
      }
    },
    arrangeNodes(nodes) {
      const rootNode = nodes.find(node => node.parentId === null);
      if (!rootNode) return;
      this.calculateNodePositions(rootNode, nodes, this.svgWidth / 2, 0);

      this.$emit('update-tree', [...nodes]);
      this.updateLevels(nodes); // 🔹 ノード配置の後に階層ラベルを更新
      this.updateScale();
    },
    updateSVGWidth() {
      const svgContainer = this.$refs.svgElement.parentElement;
      this.svgWidth = svgContainer.clientWidth;
      this.arrangeNodes(this.nodes);
    },
    updateScale() {
      const minX = Math.min(...this.nodes.map(node => node.x || 0));
      const maxX = Math.max(...this.nodes.map(node => node.x || 0));
      const minY = Math.min(...this.nodes.map(node => node.y || 0));
      const maxY = Math.max(...this.nodes.map(node => node.y || 0));

      const treeWidth = maxX - minX + this.nodeSpacingX + this.padding * 2;
      const treeHeight = maxY - minY + this.nodeSpacingY + this.padding * 2;

      const availableWidth = this.svgWidth - this.padding * 2;
      const scaleX = availableWidth / treeWidth;
      const scaleY = this.svgHeight / treeHeight;

      this.scale = Math.min(scaleX, scaleY, 1);

      this.offsetX = this.padding + (availableWidth - treeWidth * this.scale) / 2 - minX * this.scale + 12;
      this.offsetY = this.padding + (this.svgHeight - treeHeight * this.scale) / 2 - minY * this.scale;
    },
    handleZoom(event) {
      event.preventDefault();

      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * zoomFactor));
      const cursorX = (event.offsetX - this.offsetX) / this.scale;
      const cursorY = (event.offsetY - this.offsetY) / this.scale;

      this.offsetX = event.offsetX - cursorX * newScale;
      this.offsetY = event.offsetY - cursorY * newScale;
      this.scale = newScale;
    },
    startDrag(event) {
      this.isDragging = true;
      this.dragStart = { x: event.clientX, y: event.clientY };
    },
    onDrag(event) {
      if (!this.isDragging) return;

      const dx = event.clientX - this.dragStart.x;
      const dy = event.clientY - this.dragStart.y;

      this.offsetX += dx;
      this.offsetY += dy;

      this.dragStart = { x: event.clientX, y: event.clientY };
    },
    endDrag() {
      this.isDragging = false;
    },
    resetZoom() {
      this.updateScale();
    },
    getNode(nodeId) {
      return this.nodes.find(node => node.id === nodeId) || null;
    },
    selectNode(node) {
      this.$emit('select-node', node);
    },
    addChildNode(parentNode) {
      const maxId = Math.max(0, ...this.nodes.map(n => parseInt(n.id, 10))) + 1;
      this.globalNodeCounter = Math.max(this.globalNodeCounter, maxId);
      const newNode = {
        id: this.globalNodeCounter.toString(),
        label: `ノード${this.globalNodeCounter}`,
        x: parentNode.x,
        y: parentNode.y + this.nodeSpacingY,
        parentId: parentNode.id,
      };

      this.globalNodeCounter++;
      const updatedNodes = [...this.nodes, newNode];
      this.arrangeNodes(updatedNodes);
      this.updateLevels(updatedNodes); // 🔹 ノード追加時に階層情報を更新
    },
    updateNodeLabel({ id, label }) {
      const targetNode = this.nodes.find(node => node.id === id);
      if (targetNode) {
        targetNode.label = label;
        this.arrangeNodes([...this.nodes]);
        this.updateLevels(this.nodes); // 🔹 ノードのラベル変更時に階層情報を更新
      }
    },
    deleteNode(targetNode) {
      const deleteNodeRecursively = (nodeId, nodes) => {
        return nodes.filter(node => node.id !== nodeId && !isChildOf(node, nodeId));
      };
      const isChildOf = (node, parentId) => {
        if (!node.parentId) return false;
        if (node.parentId === parentId) return true;
        return isChildOf(this.getNode(node.parentId), parentId);
      };
      const updatedNodes = deleteNodeRecursively(targetNode.id, this.nodes);
      this.$emit('update-tree', updatedNodes);
      this.arrangeNodes(updatedNodes);
      this.updateLevels(updatedNodes);
    },
    editLevelName(index) {
      if (!this.levels[index]) {
        console.error(`⚠️ 階層 ${index} が存在しません。`);
        return;
      }

      const newName = prompt('階層名を入力してください:', this.levels[index].name);
      if (newName !== null) {
        this.levels[index].name = newName;
      }
    },
    updateLevels(nodes, existingLevels = []) {
      const maxDepth = Math.max(...nodes.map(node => this.getDepth(node.id, nodes)), 0);
     
      let newLevels = [];

      for (let i = 0; i <= maxDepth; i++) {
        const existingLevel = existingLevels.find(level => level.id === i + 1);
        newLevels.push({
          id: i + 1,
          name: existingLevel ? existingLevel.name : `レベル ${i + 1}`
        });
      }

      this.levels = newLevels;
    },
    arrangeNodes(nodes) {
      const rootNode = nodes.find(node => node.parentId === null);
      if (!rootNode) return;
      this.calculateNodePositions(rootNode, nodes, this.svgWidth / 2, 0);

      this.$emit('update-tree', [...nodes]);
      this.updateLevels(nodes); // 🔹 ノード配置の後に階層ラベルを更新
      this.updateScale();
    },
    getDepth(nodeId, nodes, depth = 0) {
      const node = nodes.find(n => n.id === nodeId);
      if (!node || node.parentId === null) return depth;
      return this.getDepth(node.parentId, nodes, depth + 1);
    },
    getLevelPosition(level) {
      const nodesAtLevel = this.nodes.filter(node => this.getDepth(node.id, this.nodes) === level);
      if (nodesAtLevel.length === 0) {
        return this.layoutDirection === 'vertical'
          ? this.baseY + level * this.nodeSpacingY
          : this.baseY + level * this.nodeSpacingX;
      }
      return this.layoutDirection === 'vertical'
        ? Math.min(...nodesAtLevel.map(node => node.y))
        : Math.min(...nodesAtLevel.map(node => node.x));
    },
    getTreeMinX() { return Math.min(...this.nodes.map(node => node.x)); },
    getTreeMaxX() { return Math.max(...this.nodes.map(node => node.x)); },
    getTreeMinY() { return Math.min(...this.nodes.map(node => node.y)); },
    getTreeMaxY() { return Math.max(...this.nodes.map(node => node.y)); },
    getTreeWidth() { return this.getTreeMaxX() - this.getTreeMinX(); },
    getTreeHeight() { return this.getTreeMaxY() - this.getTreeMinY(); },
   
    splitText(text) {
      if (typeof text !== 'string') {
        console.error("⚠️ splitText() に渡された値が文字列ではありません:", text);
        return ['']; // 空の配列を返してエラー回避
      }
      return text.match(/.{1,7}/g) || [''];
    },
    importData(data) {
      if (!data || !data.nodes || !Array.isArray(data.nodes)) {
        console.error("⚠️ 無効なデータ:", data);
        return alert("データ形式が正しくありません。");
      }

      this.nodes = data.nodes;

      // 🔹 最大IDを取得し、globalNodeCounter を適切に設定
      const maxId = Math.max(0, ...this.nodes.map(n => parseInt(n.id, 10))) + 1;
      this.globalNodeCounter = maxId;

      // 🔹 階層ラベルの復元（空の配列でなく、デフォルト値をセット）
      this.levels = data.levels && data.levels.length > 0 ? data.levels : [{ id: 1, name: 'レベル 1' }];

      // 🔹 ノード配置 & 階層情報を即時更新
      this.arrangeNodes(this.nodes);
      this.updateLevels(this.nodes);
    },
    updateNodeColor({ id, color }) {
      const node = this.nodes.find((node) => node.id === id);
      if (node) {
        node.color = color;
        this.$emit("update-tree", [...this.nodes]);
      }
    },
  },
  watch: {
    layoutDirection: {
      immediate: true, // 初期化時にも実行
      handler(newVal) {
        this.arrangeNodes(this.nodes); // レイアウト変更時にノード再配置
        if (Array.isArray(newVal)) {
        this.updateLevels(newVal); // ノードが変更されたら階層ラベルを更新
        }
      },
    },
  },
};
</script>


