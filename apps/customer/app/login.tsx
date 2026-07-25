import { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, t } from '@fabrything/core';

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const onSubmit = async () => {
    try {
      await signIn(id, pw);
      router.replace('/');
    } catch {
      setErr('Login failed');
    }
  };
  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Text>{t('phone', 'en')}</Text>
      <TextInput
        value={id}
        onChangeText={setId}
        autoCapitalize="none"
        keyboardType="phone-pad"
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />
      <Text>{t('password', 'en')}</Text>
      <TextInput
        value={pw}
        onChangeText={setPw}
        secureTextEntry
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />
      {err ? <Text style={{ color: 'red' }}>{err}</Text> : null}
      <Button title={t('login', 'en')} onPress={onSubmit} />
    </View>
  );
}
