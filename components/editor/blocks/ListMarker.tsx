import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlockType } from '../core/BlockNode';
import { useExtendedTheme } from '@/hooks/useExtendedTheme';

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
                <View style={styles.numberContainer}>
                    <Text style={styles.number}>{listItemNumber ?? 1}.</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingLeft: indent }]}>
            <View style={styles.bulletContainer}>
                <View style={styles.bullet} />
            </View>
        </View>
    );
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
    return StyleSheet.create({
        container: {
            justifyContent: 'center',
            alignItems: 'center',
            height: 24,
        },
        numberContainer: {
            width: 28,
            alignItems: 'flex-end',
            justifyContent: 'center',
            height: 24,
        },
        number: {
            color: theme.colors.primary,
            fontSize: 16,
            lineHeight: 16,
        },
        bulletContainer: {
            width: 24,
            alignItems: 'center',
            justifyContent: 'center',
            height: 24,
        },
        bullet: {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: theme.colors.primary,
        },
    });
}

