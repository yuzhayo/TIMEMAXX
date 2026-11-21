// Config-to-CSS translation only. Percent units use the immediate parent axis.
export function appearance(node,state){
  if(!node)throw new Error('Missing resolved node appearance');
  const patch=state?node.states?.[state]:null;
  const c={...node.colors,...patch?.colors}, g={...node.geometry,...patch?.geometry}, t={...node.typography,...patch?.typography}, a={...node.content,...patch?.content};
  return {backgroundColor:c.background,color:c.foreground,borderColor:c.border,outlineColor:c.outline,
    borderWidth:`${g.borderWidth}px`,borderStyle:'solid',borderRadius:`${g.radius}px`,
    padding:`${g.paddingY}cqh ${g.paddingX}cqw`,gap:`${g.gap}cqw`,fontSize:`${g.fontSize}px`,lineHeight:g.lineHeight,fontFamily:t.family,fontWeight:t.weight,
    letterSpacing:`${g.letterSpacing}px`,opacity:g.opacity,boxShadow:g.shadow,display:'flex',flexDirection:a.direction,
    alignItems:a.verticalAlign,justifyContent:a.horizontalAlign,textAlign:a.textAlign,whiteSpace:a.whiteSpace,overflow:a.overflow,flexWrap:a.wrap,
    minWidth:0,minHeight:g.minHeight===undefined?0:`${g.minHeight}px`};
}
export function sx(node){const root=appearance(node);return {...root,'&:hover':appearance(node,'hover'),'&:focus-visible, &.Mui-focusVisible':{...appearance(node,'focusVisible'),outlineStyle:'solid'},'&.Mui-disabled, &:disabled':appearance(node,'disabled'),'&.Mui-selected':appearance(node,'selected')};}
export const boundsStyle=b=>({position:'absolute',left:`${b.x}%`,top:`${b.y}%`,width:`${b.width}%`,height:`${b.height}%`});
export const fill={width:'100%',height:'100%',minWidth:0,minHeight:0,boxSizing:'border-box'};
export const iconStyle=node=>({width:`${node.geometry.iconWidth}%`,height:`${node.geometry.iconHeight}%`,flexShrink:0});
export function part(node,name){const p=node.parts?.[name];if(!p)return node;return {...node,...p,colors:{...node.colors,...p.colors},geometry:{...node.geometry,...p.geometry},content:{...node.content,...p.content},typography:{...node.typography,...p.typography},states:p.states??node.states};}

// UI — explicit visual contract used by frame and reusable by future applications.
// Legacy exports above still serve the unchanged reference app; frame does not call them.
export function configuredAppearance(node, state) {
  const patch = state ? node.states[state] : undefined;
  const colors = { ...node.colors, ...patch?.colors };
  const geometry = { ...node.geometry, ...patch?.geometry };
  const typography = { ...node.typography, ...patch?.typography };
  const content = { ...node.content, ...patch?.content };
  const shadow = geometry.shadow;
  return {
    backgroundColor: colors.background,
    color: colors.foreground,
    borderColor: colors.border,
    borderWidth: `${geometry.borderWidth}px`,
    borderStyle: geometry.borderStyle,
    borderRadius: `${geometry.radius}px`,
    outlineColor: colors.outline,
    outlineWidth: `${geometry.outlineWidth}px`,
    outlineStyle: geometry.outlineStyle,
    outlineOffset: `${geometry.outlineOffset}px`,
    boxShadow: shadow === 'none' ? shadow : `${shadow.inset ? 'inset ' : ''}${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${shadow.color}`,
    transition: geometry.transition === 'none' ? 'none' : geometry.transition.properties.map((property) => `${property} ${geometry.transition.durationMs}ms ${geometry.transition.easing}`).join(', '),
    padding: `${geometry.paddingY}cqh ${geometry.paddingX}cqw`,
    gap: `${geometry.gap}cqw`,
    fontSize: `${geometry.fontSize}px`,
    lineHeight: geometry.lineHeight,
    letterSpacing: `${geometry.letterSpacing}px`,
    fontFamily: typography.family,
    fontWeight: typography.weight,
    opacity: geometry.opacity,
    display: 'flex',
    flexDirection: content.direction,
    alignItems: content.direction === 'column' ? content.horizontalAlign : content.verticalAlign,
    justifyContent: content.direction === 'column' ? content.verticalAlign : content.horizontalAlign,
    textAlign: content.textAlign,
    whiteSpace: content.whiteSpace,
    overflowWrap: content.overflowWrap,
    overflow: content.overflow,
    flexWrap: content.wrap,
    minWidth: 0,
    minHeight: 0,
  };
}

export function configuredSx(node) {
  return {
    ...configuredAppearance(node),
    '&:hover': configuredAppearance(node, 'hover'),
    '&:focus-visible, &.Mui-focusVisible': configuredAppearance(node, 'focusVisible'),
    '&:active, &.Mui-active': configuredAppearance(node, 'active'),
    '&.Mui-disabled, &:disabled, &[aria-disabled="true"]': configuredAppearance(node, 'disabled'),
    '&.Mui-selected, &[aria-selected="true"]': configuredAppearance(node, 'selected'),
    '&.Mui-error, &[aria-invalid="true"]': configuredAppearance(node, 'error'),
  };
}

// UI — ratio fits its parent-relative allocation, left anchored and vertically centered.
export function configuredBounds(node) {
  const style = boundsStyle(node.bounds);
  if (node.aspectRatio === undefined) return style;
  const height = `min(${node.bounds.height}cqh, ${node.bounds.width / node.aspectRatio}cqw)`;
  return { ...style, top: `calc(${node.bounds.y}% + (${node.bounds.height}cqh - ${height}) / 2)`, width: `calc(${height} * ${node.aspectRatio})`, height };
}
