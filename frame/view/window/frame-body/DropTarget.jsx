import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { configuredSx, fill } from '@ui/appearance.mjs';

export const componentId = 'photo.dropTarget';
export const requires = ['output'];

export default function DropTarget({ config, state, actions }) {
  const target = useRef(null);
  const [active, setActive] = useState(false);

  // LOGIC — only an explicit file drop inside this configured area invokes loading.
  useEffect(() => {
    const isFileDrag = (event) => Array.from(event.dataTransfer?.types ?? []).includes('Files');
    const inside = (event) => {
      const bounds = target.current?.getBoundingClientRect();
      return bounds && event.clientX >= bounds.left && event.clientX <= bounds.right
        && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    };
    const available = () => !actions.getSnapshot().busy && typeof actions.drop === 'function';
    const over = (event) => {
      if (!isFileDrag(event) || !inside(event)) { setActive(false); return; }
      event.preventDefault();
      event.dataTransfer.dropEffect = available() ? 'copy' : 'none';
      setActive(available());
    };
    const leave = (event) => { if (!event.relatedTarget || !inside(event)) setActive(false); };
    const clear = () => setActive(false);
    const drop = (event) => {
      setActive(false);
      if (!isFileDrag(event) || !inside(event)) return;
      event.preventDefault();
      if (!available()) return;
      actions.drop(Array.from(event.dataTransfer.files), {
        componentId: config.componentId, instanceId: config.id, parentId: config.parentId,
        filePath: config.filePath, configPath: config.configPath,
      });
    };
    window.addEventListener('dragenter', over, true); window.addEventListener('dragover', over, true);
    window.addEventListener('dragleave', leave, true); window.addEventListener('dragend', clear, true); window.addEventListener('drop', drop, true);
    return () => {
      window.removeEventListener('dragenter', over, true); window.removeEventListener('dragover', over, true);
      window.removeEventListener('dragleave', leave, true); window.removeEventListener('dragend', clear, true); window.removeEventListener('drop', drop, true);
    };
  }, [config, actions]);

  // UI — configured drag feedback only; no click handler and no pointer-blocking overlay.
  return <Box ref={target} id={config.id} aria-hidden="true" data-drop-target="true"
    className={active && !state.busy ? 'Mui-active' : undefined} sx={{ ...fill, ...configuredSx(config) }} />;
}
