import React from 'react';
import Button from '@mui/material/Button';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import CropSquareRoundedIcon from '@mui/icons-material/CropSquareRounded';
import FilterNoneRoundedIcon from '@mui/icons-material/FilterNoneRounded';
import RotateLeftRoundedIcon from '@mui/icons-material/RotateLeftRounded';
import RotateRightRoundedIcon from '@mui/icons-material/RotateRightRounded';
import PhotoSizeSelectSmallRoundedIcon from '@mui/icons-material/PhotoSizeSelectSmallRounded';
import PhotoSizeSelectLargeRoundedIcon from '@mui/icons-material/PhotoSizeSelectLargeRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import RedoRoundedIcon from '@mui/icons-material/RedoRounded';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { fill, iconStyle } from './appearance.mjs';
import { configuredHostSx } from './ConfiguredContent.mjs';

const icons = {
  folderOpen: FolderOpenRoundedIcon, save: SaveRoundedIcon, close: CloseRoundedIcon,
  minimize: RemoveRoundedIcon, maximize: CropSquareRoundedIcon, restore: FilterNoneRoundedIcon,
  rotateLeft: RotateLeftRoundedIcon, rotateRight: RotateRightRoundedIcon,
  photoSizeSmall: PhotoSizeSelectSmallRoundedIcon, photoSizeLarge: PhotoSizeSelectLargeRoundedIcon,
  restartAlt: RestartAltRoundedIcon,
  undo: UndoRoundedIcon, redo: RedoRoundedIcon,
  arrowDropDown: ArrowDropDownIcon,
  edit: EditRoundedIcon,
};

// LOGIC — reusable rendering capability; file/window actions stay with their owners.
export const hasActionIcon = (name) => typeof name === 'string' && Object.hasOwn(icons, name);
export const actionIconOf = (name) => icons[name];

export function validateActionIcon(config, report) {
  if (hasActionIcon(config.icon)) return true;
  report('icon', 'registered shared action icon', config.icon);
  return false;
}

// UI — exactly one MUI button renderer for every configured action instance.
export default function ActionButton({ config, disabled, onClick, icon = config.icon, children, editable = false, invalid = false }) {
  const Icon = icons[icon];
  return <Button component={editable ? 'div' : 'button'} role={editable ? 'group' : undefined}
    tabIndex={editable ? -1 : undefined} id={config.id} aria-label={config.label} title={config.label}
    aria-invalid={invalid || undefined}
    disabled={disabled} onClick={onClick} variant="text" disableRipple disableElevation
    data-button-renderer="shared-action" data-icon={icon} sx={{ ...fill, ...configuredHostSx(config, editable ? '&:focus-within' : null),
      ...(children !== undefined ? { cursor: disabled ? 'default' : 'pointer' } : {}),
    }}>
    {children !== undefined ? children : <Icon style={iconStyle(config)} />}
  </Button>;
}
