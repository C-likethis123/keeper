import 'dart:io';

import 'package:flutter/material.dart';
import 'package:test_drive/widgets/hybrid_editor/blocks/block_config.dart';

class ImageBlockWidget extends StatelessWidget {
  final BlockConfig config;

  const ImageBlockWidget({super.key, required this.config});

  @override
  Widget build(BuildContext context) {
    return Image.file(
      File(config.block.content),
      width: 100.0,
      height: 200.0,
      fit: BoxFit.contain,
    );
  }
}
