import { useExtendedTheme } from '@/hooks/useExtendedTheme';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BlockType } from '../core/BlockNode';

interface ListMarkerProps {
    type: BlockType.bulletList | BlockType.numberedList;
    listLevel: number;
    listItemNumber?: number;
}

export function ListMarker({ type, listLevel, listItemNumber }: ListMarkerProps) {
    const theme = useExtendedTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const indent = listLevel * 16;

    if (type === BlockType.numberedList) {
        return (
            <View style={[styles.container, { paddingLeft: indent }]}>
                <Text style={styles.number}>{listItemNumber ?? 1}.</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingLeft: indent }]}>
            <View style={styles.bullet} />
        </View>
    );
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
    return StyleSheet.create({
        container: {
            justifyContent: 'center',
            alignItems: 'center',
            height: 16,
            paddingRight: 8,
        },
        number: {
            color: theme.colors.primary,
            fontSize: 16,
            lineHeight: 16,
        },
        bullet: {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: theme.colors.primary,
        },
    });
}

