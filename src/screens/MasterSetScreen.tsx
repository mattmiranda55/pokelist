import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pokeball } from '../components/Pokeball';
import { colors, radius, spacing } from '../theme';

export default function MasterSetScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.iconCluster}>
        <Pokeball size={56} />
        <View style={styles.checklistBadge}>
          <MaterialCommunityIcons name="format-list-checks" size={20} color={colors.cyan} />
        </View>
      </View>
      <Text style={styles.title}>MASTER SET</Text>
      <Text style={styles.subtitle}>Full card checklist coming online…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: spacing.xl,
  },
  iconCluster: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    position: 'relative',
  },
  checklistBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
});
