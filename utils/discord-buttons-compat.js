const { ButtonBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonStyle } = require('discord.js');


class CompatButtonBuilder {
  constructor() {
    this.button = new ButtonBuilder();
  }

  setStyle(style) {

    const styleMap = {
      'primary': ButtonStyle.Primary,
      'secondary': ButtonStyle.Secondary,
      'success': ButtonStyle.Success,
      'danger': ButtonStyle.Danger,
      'link': ButtonStyle.Link,
      'url': ButtonStyle.Link,
      'gray': ButtonStyle.Secondary,
      'red': ButtonStyle.Danger,
      'green': ButtonStyle.Success,
      'blurple': ButtonStyle.Primary,
      1: ButtonStyle.Primary,
      2: ButtonStyle.Secondary,
      3: ButtonStyle.Success,
      4: ButtonStyle.Danger,
      5: ButtonStyle.Link
    };

    this.button.setStyle(styleMap[style] || ButtonStyle.Primary);
    return this;
  }

  setLabel(label) {
    this.button.setLabel(label);
    return this;
  }

  setEmoji(emoji) {
    this.button.setEmoji(emoji);
    return this;
  }

  setURL(url) {
    this.button.setURL(url);
    return this;
  }

  setCustomId(customId) {
    this.button.setCustomId(customId);
    return this;
  }

  setDisabled(disabled = true) {
    this.button.setDisabled(disabled);
    return this;
  }

  build() {
    return this.button;
  }
}

class CompatActionRowBuilder {
  constructor() {
    this.row = new ActionRowBuilder();
  }

  addComponents(...components) {

    const convertedComponents = components.map((comp) => {
      if (comp instanceof CompatButtonBuilder) {
        return comp.build();
      }
      if (comp instanceof CompatMessageMenuBuilder) {
        return comp.build();
      }
      return comp;
    });

    this.row.addComponents(...convertedComponents);
    return this;
  }

  setComponents(...components) {
    const convertedComponents = components.map((comp) => {
      if (comp instanceof CompatButtonBuilder) {
        return comp.build();
      }
      if (comp instanceof CompatMessageMenuBuilder) {
        return comp.build();
      }
      return comp;
    });

    this.row.setComponents(...convertedComponents);
    return this;
  }

  build() {
    return this.row;
  }

  toJSON() {
    return this.row.toJSON();
  }
}

class CompatMessageMenuBuilder {
  constructor() {
    this.menu = new StringSelectMenuBuilder();
  }

  setCustomId(customId) {
    this.menu.setCustomId(customId);
    return this;
  }

  setPlaceholder(placeholder) {
    this.menu.setPlaceholder(placeholder);
    return this;
  }

  setMinValues(min) {
    this.menu.setMinValues(min);
    return this;
  }

  setMaxValues(max) {
    this.menu.setMaxValues(max);
    return this;
  }

  addOptions(...options) {

    const convertedOptions = options.map((option) => {
      if (option instanceof CompatMessageMenuOption) {
        return option.build();
      }
      return option;
    });

    this.menu.addOptions(...convertedOptions);
    return this;
  }

  setOptions(...options) {
    const convertedOptions = options.map((option) => {
      if (option instanceof CompatMessageMenuOption) {
        return option.build();
      }
      return option;
    });

    this.menu.setOptions(...convertedOptions);
    return this;
  }

  build() {
    return this.menu;
  }
}

class CompatMessageMenuOption {
  constructor() {
    this.option = {
      label: '',
      value: ''
    };
  }

  setLabel(label) {
    this.option.label = label;
    return this;
  }

  setValue(value) {
    this.option.value = value;
    return this;
  }

  setDescription(description) {
    this.option.description = description;
    return this;
  }

  setEmoji(emoji) {
    this.option.emoji = emoji;
    return this;
  }

  setDefault(isDefault = true) {
    this.option.default = isDefault;
    return this;
  }

  build() {
    return this.option;
  }
}


function createButton(style, label, customId, options = {}) {
  const button = new CompatButtonBuilder().
  setStyle(style).
  setLabel(label);

  if (style === 'url' || style === 'link' || style === ButtonStyle.Link) {
    button.setURL(customId);
  } else {
    button.setCustomId(customId);
  }

  if (options.emoji) button.setEmoji(options.emoji);
  if (options.disabled) button.setDisabled(options.disabled);

  return button;
}

function createActionRow(...components) {
  return new CompatActionRowBuilder().addComponents(...components);
}

function createSelectMenu(customId, placeholder, options = []) {
  const menu = new CompatMessageMenuBuilder().
  setCustomId(customId).
  setPlaceholder(placeholder);

  if (options.length > 0) {
    menu.addOptions(...options);
  }

  return menu;
}


function convertMessageOptions(content, components) {
  const options = {};

  if (typeof content === 'string') {
    options.content = content;
  } else if (content && content.constructor && content.constructor.name === 'EmbedBuilder') {
    options.embeds = [content];
  } else if (Array.isArray(content)) {
    options.embeds = content;
  }

  if (components) {
    if (Array.isArray(components)) {
      options.components = components.map((comp) => {
        if (comp instanceof CompatActionRowBuilder) {
          return comp.build();
        }
        if (comp instanceof CompatButtonBuilder) {
          return new ActionRowBuilder().addComponents(comp.build());
        }
        return comp;
      });
    } else if (components instanceof CompatActionRowBuilder) {
      options.components = [components.build()];
    } else if (components instanceof CompatButtonBuilder) {
      options.components = [new ActionRowBuilder().addComponents(components.build())];
    }
  }

  return options;
}


module.exports = {

  ButtonBuilder: CompatButtonBuilder,
  ActionRowBuilder: CompatActionRowBuilder,
  MessageMenu: CompatMessageMenuBuilder,
  MessageMenuOption: CompatMessageMenuOption,


  createButton,
  createActionRow,
  createSelectMenu,
  convertMessageOptions,


  ButtonStyle: {
    PRIMARY: 'primary',
    SECONDARY: 'secondary',
    SUCCESS: 'success',
    DANGER: 'danger',
    LINK: 'url'
  }
};
