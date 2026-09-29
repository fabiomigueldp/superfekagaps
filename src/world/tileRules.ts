import { TileType } from '../constants';

/** Tile behaviour shared by collision, surface searches and level tools. */
export function isSolidTile(tile: number): boolean {
  switch (tile) {
    case TileType.GROUND:
    case TileType.BRICK:
    case TileType.BRICK_BREAKABLE:
    case TileType.POWERUP_BLOCK_MINI_FANTA:
    case TileType.POWERUP_BLOCK_HELMET:
    case TileType.BLOCK_USED:
    case TileType.SPRING:
    case TileType.ICE:
    case TileType.LAVA_TOP:
    case TileType.LAVA_FILL:
    case TileType.CAVE_STONE:
      return true;
    default:
      return false;
  }
}

export function isOneWayTile(tile: number): boolean {
  return tile === TileType.PLATFORM ||
    tile === TileType.PLATFORM_FALLING ||
    tile === TileType.CAVE_PLATFORM;
}

export function blocksHead(tile: number): boolean {
  return isSolidTile(tile) || tile === TileType.HIDDEN_BLOCK;
}

export function supportsStanding(tile: number): boolean {
  return isSolidTile(tile) || isOneWayTile(tile);
}
