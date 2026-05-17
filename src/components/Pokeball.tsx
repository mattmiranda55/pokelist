import Svg, {
  Circle,
  Defs,
  FeGaussianBlur,
  FeMerge,
  FeMergeNode,
  Filter,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { colors } from '../theme';

export function Pokeball({ size = 28 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Defs>
        <LinearGradient id="pb-red" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ff6b6b" />
          <Stop offset="1" stopColor={colors.primaryDeep} />
        </LinearGradient>
        <LinearGradient id="pb-dark" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.surfaceElevated} />
          <Stop offset="1" stopColor={colors.bg} />
        </LinearGradient>
        <Filter id="pb-glow" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur stdDeviation="1.4" result="b" />
          <FeMerge>
            <FeMergeNode in="b" />
            <FeMergeNode in="SourceGraphic" />
          </FeMerge>
        </Filter>
      </Defs>
      <Circle cx="32" cy="32" r="29" fill="url(#pb-dark)" stroke={colors.borderStrong} strokeWidth="2" />
      <Path d="M 3 32 A 29 29 0 0 1 61 32 Z" fill="url(#pb-red)" />
      <Rect x="3" y="29" width="58" height="6" fill={colors.bg} />
      <Circle cx="32" cy="32" r="8.5" fill={colors.bg} stroke={colors.borderStrong} strokeWidth="2" />
      <Circle cx="32" cy="32" r="4" fill={colors.text} filter="url(#pb-glow)" />
    </Svg>
  );
}
