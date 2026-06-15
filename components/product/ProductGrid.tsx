import React from "react";
import { FlatList, StyleSheet, Dimensions } from "react-native";
import { ProductCard } from "./ProductCard";
import type { Product } from "@/lib/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;
const NUM_COLUMNS = 2;

interface ProductGridProps {
  products: Product[];
  horizontal?: boolean;
  onEndReached?: () => void;
  ListFooterComponent?: React.ReactElement;
}

export function ProductGrid({ products, horizontal, onEndReached, ListFooterComponent }: ProductGridProps) {
  if (horizontal) {
    return (
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ProductCard product={item} horizontal />}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalContainer}
      />
    );
  }

  return (
    <FlatList
      data={products}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ProductCard product={item} />}
      numColumns={NUM_COLUMNS}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.gridContainer}
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={ListFooterComponent}
    />
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  row: {
    justifyContent: "space-between",
  },
  horizontalContainer: {
    paddingHorizontal: 16,
    gap: 0,
  },
});
