const axios = require('axios');
const db = require('../../utils/simpledb');
const { checkOsintPermission } = require('../../utils/osintHelpers');
const { container, txt, sep, FLAGS } = require('../../utils/v2');

module.exports = {
    name: 'phoneinfo',
    aliases: ['phone', 'numlookup'],
    description: 'Analyse un numéro de téléphone (valide, pays, opérateur, type de ligne, etc.)',
    run: async (client, message, args) => {
        if (!checkOsintPermission(client, message)) return;

        const cost = 5;
        const level = db.get(`guild_${message.guild.id}_level_${message.author.id}`) || 1;
        const totalCredits = (db.get(`user_credits_${message.author.id}`) || 0) + (db.get(`daily_credits_${message.author.id}`) || 0) + level * 2;

        if (totalCredits < cost) {
            return message.channel.send({
                components: [container(txt('## ❌ Crédits insuffisants'), sep(), txt(`**Coût :** ${cost} crédits\n**Vos crédits :** ${totalCredits} crédits`))],
                flags: FLAGS
            });
        }

        const phoneNumber = args[0];
        if (!phoneNumber) return message.reply({ content: '<a:_:1483497365863399536> Veuillez spécifier un **numéro de téléphone**.', allowedMentions: { repliedUser: false } });

        const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
        if (cleanNumber.length < 8) return message.reply({ content: '<a:_:1483497365863399536> Numéro de téléphone invalide.', allowedMentions: { repliedUser: false } });

        db.subtract(`user_credits_${message.author.id}`, cost);

        const loadingMsg = await message.channel.send({
            components: [container(txt('## 🔍 Analyse du numéro...'), sep(), txt(`Analyse de \`${cleanNumber}\`...`))],
            flags: FLAGS
        });

        let data = null, twilioData = null, reputation = null;

        try {
            const response = await axios.get('http://apilayer.net/api/validate', { params: { access_key: process.env.NUMVERIFY_API_KEY || 'demo', number: cleanNumber, country_code: '', format: 1 }, timeout: 10000 });
            data = response.data;
        } catch {}

        try {
            const twilioRes = await axios.get(`https://lookups.twilio.com/v1/PhoneNumbers/${cleanNumber}`, { params: { Type: 'carrier', country_code: '' }, auth: { username: process.env.TWILIO_SID || '', password: process.env.TWILIO_TOKEN || '' }, timeout: 10000 });
            twilioData = twilioRes.data;
        } catch {}

        try {
            const repRes = await axios.get(`https://phonevalidation.abstractapi.com/v1/?api_key=${process.env.ABSTRACT_API_KEY || ''}&phone=${cleanNumber}`);
            reputation = repRes.data;
        } catch {}

        const lines = [
            `**Numéro :** \`${cleanNumber}\``,
            `**Validité :** ${data && data.valid ? '✅ Valide' : '❌ Invalide/Inconnu'}`,
            `**Format international :** ${data?.international_format || twilioData?.phone_number || 'N/A'}`,
            `**Format local :** ${data?.local_format || 'N/A'}`,
            `**Pays :** ${data?.country_name || twilioData?.country_code || 'N/A'}`,
            `**Localisation :** ${data?.location || reputation?.location || 'N/A'}`,
            `**Opérateur :** ${data?.carrier || twilioData?.carrier?.name || 'N/A'}`,
            `**Type de ligne :** ${data?.line_type || twilioData?.carrier?.type || 'N/A'}`
        ];

        if (reputation) {
            lines.push(`**Réputation :** ${reputation.is_valid ? '✅ Valide' : '⚠️ Suspect ou spam'}`);
            lines.push(`**Type :** ${reputation.type || 'N/A'}`);
            lines.push(`**VoIP :** ${reputation.is_virtual ? 'Oui' : 'Non'}`);
        }

        lines.push('', '*Sources : NumVerify, Twilio, AbstractAPI*');

        await loadingMsg.edit({
            components: [container(
                txt('## 📞 Analyse Téléphone'),
                sep(),
                txt(lines.join('\n'))
            )],
            flags: FLAGS
        });
    }
};
