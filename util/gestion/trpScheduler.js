const Discord = require('discord.js');
const db = require('../../utils/simpledb');

function numberFmt(n) {
  try { return Number(n || 0).toLocaleString('fr-FR'); } catch (_) { return String(n || 0); }
}

async function getLiveStats(guild) {
  try { await guild.members.fetch(); } catch (_) { }

  const totalMembers = guild.memberCount;
  const onlineMembers = guild.members.cache.filter((m) =>
    m.presence?.status === 'online' || m.presence?.status === 'idle' || m.presence?.status === 'dnd'
  ).size;

  const voiceChannels = guild.channels.cache.filter((ch) => ch.type === Discord.ChannelType.GuildVoice);
  let totalInVoice = 0;
  let streamingCount = 0;
  voiceChannels.forEach((ch) => {
    totalInVoice += ch.members.size;
    ch.members.forEach((m) => { if (m.voice?.streaming) streamingCount++; });
  });

  const boostCount = guild.premiumSubscriptionCount || 0;

  return {
    '{members}': numberFmt(totalMembers),
    '{online}': numberFmt(onlineMembers),
    '{in_voice}': numberFmt(totalInVoice),
    '{streaming}': numberFmt(streamingCount),
    '{boosts}': numberFmt(boostCount)
  };
}

function replacePlaceholders(text, stats) {
    if (!text) return text;
    let newText = text;
    for (const [key, value] of Object.entries(stats)) {
        // Use global regex replacement to catch multiples
        const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
        newText = newText.replace(regex, value);
    }
    return newText;
}

async function applyStatsToEmbedJSON(guild, rawEmbedJSON) {
    const stats = await getLiveStats(guild);
    
    // Create a deep copy to not mutate the raw database object
    const embedData = JSON.parse(JSON.stringify(rawEmbedJSON));

    if (embedData.title) embedData.title = replacePlaceholders(embedData.title, stats);
    if (embedData.description) embedData.description = replacePlaceholders(embedData.description, stats);
    
    if (embedData.author && embedData.author.name) {
        embedData.author.name = replacePlaceholders(embedData.author.name, stats);
    }
    if (embedData.footer && embedData.footer.text) {
        embedData.footer.text = replacePlaceholders(embedData.footer.text, stats);
    }
    
    if (embedData.fields) {
        embedData.fields = embedData.fields.map(field => ({
            ...field,
            name: replacePlaceholders(field.name, stats),
            value: replacePlaceholders(field.value, stats)
        }));
    }

    // Force a timestamp update if we want to show it's updating, or keep it static?
    // Let's keep it static unless they requested one, but add a small auto "Mis à jour" maybe in production.
    embedData.timestamp = new Date().toISOString(); 

    return new Discord.EmbedBuilder(embedData);
}

function startTRPScheduler(client) {
  // Tourne toutes les 30 minutes (1800000 ms)
  setInterval(async () => {
    try {
      client.guilds.cache.forEach(async (guild) => {
        try {
          if (typeof client.isResponsibleForGuild === 'function' && !client.isResponsibleForGuild(guild.id)) return;
          
          const webhookData = db.get(`trp_webhook_${guild.id}`);
          const messageId = db.get(`trp_message_${guild.id}`);
          const rawEmbedJSON = db.get(`trp_embed_${guild.id}`);

          // If no webhook configured for this guild, skip
          if (!webhookData || !webhookData.id || !webhookData.token || !messageId || !rawEmbedJSON) return;

          try {
            const webhook = new Discord.WebhookClient({ id: webhookData.id, token: webhookData.token });
            
            const liveEmbed = await applyStatsToEmbedJSON(guild, rawEmbedJSON);
            
            await webhook.editMessage(messageId, {
                embeds: [liveEmbed]
            });
            
          } catch (err) {
            console.error(`[TRP-WEBHOOK] Impossible de mettre à jour le webhook sur ${guild.name} (${guild.id}) - Peut-être supprimé ?`, err?.message);
            // Optionally: if Unknown Webhook, auto-delete from DB
            if (err?.code === 10015 || err?.code === 10008) {
                db.delete(`trp_webhook_${guild.id}`);
                db.delete(`trp_message_${guild.id}`);
                db.delete(`trp_embed_${guild.id}`);
            }
          }

        } catch (e) {
          console.error('TRP webhook loop error for guild', guild?.id, e);
        }
      });
    } catch (e) {
      console.error('TRP webhook main loop error:', e);
    }
  }, 30 * 60 * 1000); 
}

module.exports = { startTRPScheduler, applyStatsToEmbedJSON };
