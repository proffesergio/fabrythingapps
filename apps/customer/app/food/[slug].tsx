import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  FoodItem,
  FoodOptionGroup,
  RestaurantDetail,
  StoreApiError,
  fetchRestaurant,
  t,
  theme,
  useFoodCart,
} from '@fabrything/core';
import { api } from '../../src/providers';
import {
  EmptyView,
  ErrorView,
  LoadingView,
  MIN_TAP_TARGET,
  PrimaryButton,
  SecondaryButton,
} from '../../src/components/StateViews';

export default function RestaurantMenu() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const cart = useFoodCart();
  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<FoodItem | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRestaurant(await fetchRestaurant(api, String(slug)));
    } catch (e) {
      setError((e as StoreApiError).message || t('somethingWrong', 'en'));
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const closed = !!restaurant && (!restaurant.is_open_now || !restaurant.is_accepting_orders);

  // Adding from a different restaurant wipes the cart (a food order carries one
  // restaurant_slug), so warn before destroying what the customer built rather
  // than silently discarding it.
  const addLine = useCallback(
    (item: FoodItem, optionIds: number[], labels: { name: string; price_delta: string }[]) => {
      if (!restaurant) return;
      const line = {
        itemId: item.id,
        restaurantSlug: restaurant.slug,
        name: item.display_name || item.name,
        image: item.image,
        unitPrice: item.effective_price,
        optionIds,
        optionLabels: labels,
      };
      if (cart.wouldReplaceCart(restaurant.slug)) {
        Alert.alert(t('switchRestaurantTitle', 'en'), t('switchRestaurantBody', 'en'), [
          { text: t('keepCart', 'en'), style: 'cancel' },
          { text: t('startNewCart', 'en'), style: 'destructive', onPress: () => cart.addItem(line) },
        ]);
        return;
      }
      cart.addItem(line);
    },
    [cart, restaurant],
  );

  const onAdd = useCallback(
    (item: FoodItem) => {
      if (item.option_groups?.length) {
        setPicking(item);
        return;
      }
      addLine(item, [], []);
    },
    [addLine],
  );

  if (error && !restaurant) return <ErrorView message={error} onRetry={load} />;
  if (!restaurant) return <LoadingView />;

  const categories = (restaurant.categories || []).filter((c) => c.items?.length);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        {restaurant.cover_image ? (
          <Image
            source={{ uri: restaurant.cover_image }}
            style={{ width: '100%', height: 160 }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : null}

        <View style={{ padding: 16, gap: 6 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: theme.light.text }}>
            {restaurant.display_name || restaurant.name}
          </Text>
          {restaurant.address ? (
            <Text style={{ color: theme.light.muted }}>{restaurant.address}</Text>
          ) : null}
          <Text style={{ color: theme.light.muted, fontSize: 13 }}>
            {t('minOrder', 'en')} ৳{restaurant.min_order_amount} · ~{restaurant.avg_prep_minutes} min
          </Text>
          {closed ? (
            <View
              accessibilityRole="alert"
              style={{
                marginTop: 6, padding: 10, borderRadius: 8,
                backgroundColor: '#FDECEA', borderWidth: 1, borderColor: '#F5C6C2',
              }}
            >
              <Text style={{ color: theme.light.primaryDeep, fontWeight: '600' }}>
                {t('restaurantClosedNow', 'en')}
                {restaurant.next_open ? ` ${t('opens', 'en')} ${restaurant.next_open.open_time}` : ''}
              </Text>
            </View>
          ) : null}
        </View>

        {categories.length === 0 ? (
          <EmptyView message={t('noProducts', 'en')} />
        ) : (
          categories.map((c) => (
            <View key={c.id} style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <Text
                style={{ fontSize: 17, fontWeight: '700', marginVertical: 10, color: theme.light.text }}
              >
                {c.display_name || c.name}
              </Text>
              {c.items.map((item) => (
                <MenuRow key={item.id} item={item} disabled={closed} onAdd={() => onAdd(item)} />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {cart.totals.itemCount > 0 ? (
        <View
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12,
            backgroundColor: theme.light.surface, borderTopWidth: 1, borderTopColor: theme.light.line,
          }}
        >
          <PrimaryButton
            title={`${t('viewCart', 'en')} (${cart.totals.itemCount}) · ৳${cart.totals.subtotal.toFixed(2)}`}
            accessibilityLabel={t('viewCart', 'en')}
            onPress={() => router.push('/food/cart')}
          />
        </View>
      ) : null}

      {picking ? (
        <OptionPicker
          item={picking}
          onCancel={() => setPicking(null)}
          onConfirm={(ids, labels) => {
            addLine(picking, ids, labels);
            setPicking(null);
          }}
        />
      ) : null}
    </View>
  );
}

function MenuRow({
  item,
  disabled,
  onAdd,
}: {
  item: FoodItem;
  disabled: boolean;
  onAdd: () => void;
}) {
  // `available_now` honours the item's own time window; `is_available` alone
  // would offer a breakfast item at midnight and the order would 400.
  const orderable = item.available_now && !disabled;
  return (
    <View
      style={{
        flexDirection: 'row', gap: 12, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: theme.light.line, alignItems: 'center',
      }}
    >
      {item.image ? (
        <Image
          source={{ uri: item.image }}
          style={{ width: 64, height: 64, borderRadius: 8 }}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontWeight: '600', color: theme.light.text }}>
          {item.display_name || item.name}
        </Text>
        {item.description ? (
          <Text numberOfLines={2} style={{ color: theme.light.muted, fontSize: 12 }}>
            {item.description}
          </Text>
        ) : null}
        <Text style={{ color: theme.light.text, fontWeight: '700' }}>৳{item.effective_price}</Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${t('addToFoodCart', 'en')} ${item.display_name || item.name}`}
        accessibilityState={{ disabled: !orderable }}
        disabled={!orderable}
        onPress={onAdd}
        style={{
          minHeight: MIN_TAP_TARGET, minWidth: 64, borderRadius: 8, paddingHorizontal: 12,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: orderable ? theme.light.primary : theme.light.line,
        }}
      >
        <Text style={{ color: orderable ? '#fff' : theme.light.muted, fontWeight: '700' }}>
          {orderable ? t('addToFoodCart', 'en') : t('unavailable', 'en')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/** Enforces each group's min/max client-side so the customer is not told "an
 *  invalid option was selected" only after submitting the whole order. */
function OptionPicker({
  item,
  onCancel,
  onConfirm,
}: {
  item: FoodItem;
  onCancel: () => void;
  onConfirm: (ids: number[], labels: { name: string; price_delta: string }[]) => void;
}) {
  const groups = item.option_groups || [];
  const [selected, setSelected] = useState<Record<number, number[]>>(() => {
    const initial: Record<number, number[]> = {};
    for (const g of groups) {
      const defaults = g.options.filter((o) => o.is_default).map((o) => o.id);
      initial[g.id] = defaults.slice(0, Math.max(1, g.max_select || 1));
    }
    return initial;
  });

  const toggle = (g: FoodOptionGroup, optionId: number) => {
    setSelected((cur) => {
      const chosen = cur[g.id] || [];
      const has = chosen.includes(optionId);
      if (has) return { ...cur, [g.id]: chosen.filter((id) => id !== optionId) };
      // max_select of 1 behaves as a radio, not a checkbox that refuses input.
      if ((g.max_select || 1) <= 1) return { ...cur, [g.id]: [optionId] };
      if (chosen.length >= g.max_select) return cur;
      return { ...cur, [g.id]: [...chosen, optionId] };
    });
  };

  const unmet = useMemo(
    () =>
      groups.find((g) => {
        const n = (selected[g.id] || []).length;
        if (g.is_required && n < Math.max(1, g.min_select)) return true;
        return n < (g.min_select || 0);
      }),
    [groups, selected],
  );

  const confirm = () => {
    const ids: number[] = [];
    const labels: { name: string; price_delta: string }[] = [];
    for (const g of groups) {
      for (const id of selected[g.id] || []) {
        const opt = g.options.find((o) => o.id === id);
        if (opt) {
          ids.push(opt.id);
          labels.push({ name: opt.name, price_delta: opt.price_delta });
        }
      }
    }
    onConfirm(ids, labels);
  };

  return (
    // A real <Modal>, not an in-tree overlay: onRequestClose is what makes the
    // Android hardware back button dismiss the sheet instead of leaving the
    // customer stuck behind it.
    <Modal transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }}>
        <View
          style={{
            backgroundColor: theme.light.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16,
            padding: 16, maxHeight: '85%',
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8, color: theme.light.text }}>
            {item.display_name || item.name}
          </Text>
          <ScrollView>
            {groups.map((g) => (
              <View key={g.id} style={{ marginBottom: 16 }}>
                <Text style={{ fontWeight: '700', color: theme.light.text }}>
                  {g.name}
                  {g.is_required ? ` · ${t('required', 'en')}` : ''}
                </Text>
                {g.max_select > 1 ? (
                  <Text style={{ color: theme.light.muted, fontSize: 12, marginBottom: 4 }}>
                    {t('pickAtMost', 'en')} {g.max_select}
                  </Text>
                ) : null}
                {g.options.map((o) => {
                  const on = (selected[g.id] || []).includes(o.id);
                  return (
                    <TouchableOpacity
                      key={o.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={o.name}
                      onPress={() => toggle(g, o.id)}
                      style={{
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        minHeight: MIN_TAP_TARGET, paddingHorizontal: 10, borderRadius: 8,
                        borderWidth: 1, marginTop: 6,
                        borderColor: on ? theme.light.primary : theme.light.line,
                        backgroundColor: on ? '#FDF0ED' : 'transparent',
                      }}
                    >
                      <Text style={{ color: theme.light.text }}>{o.name}</Text>
                      <Text style={{ color: theme.light.muted }}>
                        {Number(o.price_delta) ? `৳${o.price_delta}` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <SecondaryButton title={t('keepCart', 'en')} accessibilityLabel="cancel-options" onPress={onCancel} />
            </View>
            <View style={{ flex: 2 }}>
              <PrimaryButton
                title={t('addToFoodCart', 'en')}
                accessibilityLabel="confirm-options"
                disabled={!!unmet}
                onPress={confirm}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
