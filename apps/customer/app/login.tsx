import { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useCart, mergeCartOnLogin, t } from '@fabrything/core';
import { api } from '../src/providers';

export default function Login() {
  const { signIn } = useAuth();
  const { lines, clear } = useCart();
  const router = useRouter();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const onSubmit = async () => {
    try {
      await signIn(id, pw);
      // Merge-on-login: a guest may have added lines to the local cart before
      // signing in. Union them into the server cart, then clear the local
      // copy -- the server is the source of truth from here on. Best-effort:
      // if the merge call fails, keep the local cart rather than lose it, and
      // still let the user in.
      if (lines.length > 0) {
        try {
          await mergeCartOnLogin(api, lines);
          clear();
        } catch {
          // Local cart is preserved for a future retry.
        }
      }
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
