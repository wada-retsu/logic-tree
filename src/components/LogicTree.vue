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
      <g :transform="`translate(${offsetX}, ${offsetY}) scale(${scale})`">
        
        <!-- 階層ラベル（ツリーと一緒に移動） -->
        <g v-for="(level, index) in levels" :key="'bg-' + index">
          <!-- 背景ラベル -->
          <rect
          :x="this.layoutDirection === 'vertical' ? getTreeMinX() - padding - 50 : getLevelPosition(index) - nodeSpacingX / 2"
          :y="this.layoutDirection === 'vertical' ? getLevelPosition(index) - nodeSpacingY / 2 : getTreeMinY() - padding - 50"
          :width="this.layoutDirection === 'vertical' ? getTreeWidth() + padding * 2 + 100 : nodeSpacingX"
          :height="this.layoutDirection === 'vertical' ? nodeSpacingY : getTreeHeight() + padding * 2 + 100"
            fill="lightgray"
            opacity="0.3"
          />
          <!-- ラベル名（ダブルクリックで編集可能） -->
          <text
          :x="this.layoutDirection === 'vertical' 
            ? getTreeMinX() + getTreeWidth() + padding + 120
            : getLevelPosition(index) - 10"
          :y="this.layoutDirection === 'vertical' 
            ? getLevelPosition(index) + 5
            : getTreeMinY() + getTreeHeight() + padding + 80"
            text-anchor="end"
            fill="black"
            font-size="16"
            font-weight="bold"
            @dblclick="editLevelName(index)"
          >
            {{ levels[index] }}
          </text>
        </g>

        <!-- ノード間の線 -->
        <line
          v-for="node in nodes"
          :key="'line-' + node.id"
          :x1="getNode(node.parentId)?.x || node.x || 0"
          :y1="getNode(node.parentId)?.y || node.y || 0"
          :x2="node.x || 0"
          :y2="node.y || 0"
          stroke="black"
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
          @select="selectNode"
          @add-child="addChildNode"
          @update-label="updateNodeLabel"
          @delete-node="deleteNode"
        />
      </g>
    </svg>
  </div>
</template>

<script>
import TreeNode from './TreeNode.vue';

export default {
  components: { TreeNode },
  props: ['nodes', 'selectedNode', 'editingNodeId', 'layoutDirection'],
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
      levels: ['レベル 1'], // 階層ラベル
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
      this.updateLevels(nodes);
      this.$emit('update-tree', [...nodes]);
      this.updateScale(); // スケールを更新
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

      this.scale = Math.min(scaleX, scaleY, 1); // スケールは1以下に限定

      this.offsetX = this.padding + (availableWidth - treeWidth * this.scale) / 2 - minX * this.scale + 12;
      this.offsetY = this.padding + (this.svgHeight - treeHeight * this.scale) / 2 - minY * this.scale;
    },
    handleZoom(event) {
      event.preventDefault();

      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * zoomFactor));

      // マウスの位置を基準にズーム
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

      // ドラッグ量を計算
      const dx = event.clientX - this.dragStart.x;
      const dy = event.clientY - this.dragStart.y;

      // オフセットを更新
      this.offsetX += dx;
      this.offsetY += dy;

      // ドラッグ開始位置を更新
      this.dragStart = { x: event.clientX, y: event.clientY };
    },
    endDrag() {
      this.isDragging = false;
    },
    resetZoom() {
      this.updateScale(); // 全体表示にリセット
    },
    getNode(nodeId) {
      return this.nodes.find(node => node.id === nodeId) || null;
    },
    selectNode(node) {
      this.$emit('select-node', node);
    },
    addChildNode(parentNode) {
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
    },
    updateNodeLabel({ id, label }) {
      const targetNode = this.nodes.find(node => node.id === id);
      if (targetNode) {
        targetNode.label = label;
        this.arrangeNodes([...this.nodes]);
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
    },
    editLevelName(index) {
      const newName = prompt('階層名を入力してください:', this.levels[index]);
      if (newName !== null) {
        this.levels[index] = newName;
      }
    },
    updateLevels(nodes) {
      const maxDepth = Math.max(...nodes.map(node => this.getDepth(node.id, nodes)), 0);
      while (this.levels.length <= maxDepth) {
        this.levels.push(`レベル ${this.levels.length + 1}`);
      }
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
  },
  watch: {
    layoutDirection: {
      immediate: true, // 初期化時にも実行
      handler() {
        this.arrangeNodes(this.nodes); // レイアウト変更時にノード再配置
      },
    },
  },
};
</script>
