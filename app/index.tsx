import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/screens/welcome.styles';
import { colors } from '../styles/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={require('../assets/images/AppLogo.png')}
            style={styles.logo}
          />
        </View>

        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Disaster Report and</Text>
          <Text style={styles.heroTitleAccent}>Risk Management.</Text>
          <Text style={styles.heroSubtitle}>
            Report and connect with your community.{'\n'}
            Stay informed. Keep everyone safe.
          </Text>
        </View>

        <View style={styles.conceptSection}>
          <View style={styles.conceptImageWrapper}>
            <Image
              source={require('../assets/images/Concept.png')}
              style={styles.conceptImage}
            />
          </View>
        </View>

        <View style={styles.buttonsSection}>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#000000', '#000000']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.getStartedButton}
            >
              <Ionicons name="return-down-forward-outline" size={18} color={colors.white} />
              <Text style={styles.getStartedText}>Get Started</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.loginText}>Login</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.guestButton}
            onPress={() => router.push('/(main)/home')}
            activeOpacity={0.7}
          >
            <Text style={styles.guestText}>Continue as Guest →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
