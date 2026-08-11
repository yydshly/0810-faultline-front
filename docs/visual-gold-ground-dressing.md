# 视觉金标地表层契约

`visual-gold-review` 在不改变玩法平面的前提下，增加一组仅供桌面金标首屏使用的基地地表层。总部与载具工厂分别拥有服务地坪和入口喉道，两条喉道汇入同一条连续的 Y 形服务道路。道路同时包含路肩、轮迹与油污、玩家阵营角标，以及薄片式导向地标。

## 运行边界

- 只在 `visual-gold-review` 创建；普通对局与其它评审夹具不受影响。
- 六个稳定命名的 `InstancedMesh` 批次，共 49 个实例。
- 理论新增绘制调用为 6，最坏可见三角形为 720。
- 所有实例明确标记 `collision=none`、`navigation=none`，不加入选择或射线拾取集合。
- 所有表面最高点为 `0.014m`，低于 `0.015m` 上限；没有坡度、台阶或新的移动高度。
- 复用现有箱体/圆片几何与混凝土、道路、路肩、轮迹、玩家阵营和警示材质；没有新增纹理、灯光或材质。

## 稳定批次名

1. `visual-gold-review-service-aprons`
2. `visual-gold-review-entrance-route`
3. `visual-gold-review-route-shoulders`
4. `visual-gold-review-service-wear-and-oil`
5. `visual-gold-review-player-corner-markers`
6. `visual-gold-review-wayfinding-tabs`

`src/game/scene-visual-gold-dressing.test.ts` 锁定批次名称、实例唯一性、两座建筑到出场道路的连续性、平面高度以及绘制/三角形预算。
