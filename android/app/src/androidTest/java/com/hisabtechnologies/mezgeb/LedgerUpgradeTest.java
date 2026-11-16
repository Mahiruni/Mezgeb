package com.hisabtechnologies.mezgeb;

import android.app.Activity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Emulator-only synthetic data. No production account, no real financial records. */
@RunWith(AndroidJUnit4.class)
public class LedgerUpgradeTest {
    private static final String ORIGIN="https://mezgeb-omega.vercel.app";
    private static final String BUSINESS="CI Upgrade Ledger";
    private static WebView find(View v){
        if(v instanceof WebView)return (WebView)v;
        if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++){WebView found=find(g.getChildAt(i));if(found!=null)return found;}}
        return null;
    }
    private Object js(ActivityScenario<MainActivity> scenario,String code)throws Exception{
        CountDownLatch done=new CountDownLatch(1);
        AtomicReference<String> raw=new AtomicReference<>();
        scenario.onActivity(a->{WebView web=find(a.getWindow().getDecorView());if(web==null){done.countDown();return;}web.evaluateJavascript(code,value->{raw.set(value);done.countDown();});});
        assertTrue("WebView JavaScript callback timed out",done.await(8,TimeUnit.SECONDS));
        assertNotNull("WebView is missing",raw.get());
        return new JSONTokener(raw.get()).nextValue();
    }
    private void waitFor(ActivityScenario<MainActivity> scenario,String code,String expected)throws Exception{
        Object latest=null;
        for(int i=0;i<60;i++){latest=js(scenario,code);if(expected.equals(String.valueOf(latest)))return;Thread.sleep(500);}
        fail("Expected "+expected+" but received "+latest);
    }
    private void ready(ActivityScenario<MainActivity> scenario)throws Exception{
        waitFor(scenario,"document.title","Mezgeb Ready");
        assertEquals(ORIGIN,js(scenario,"location.origin"));
    }
    private void readFixture(ActivityScenario<MainActivity> scenario)throws Exception{
        js(scenario,"(function(){window.__ciResult='pending';var r=indexedDB.open('mezgeb_local_v2');r.onerror=function(){window.__ciResult='open-error'};r.onsuccess=function(){var db=r.result;var tx=db.transaction('documents','readonly');var g=tx.objectStore('documents').get('main');g.onsuccess=function(){var d=g.result&&g.result.value;window.__ciResult=!!(d&&d.business.name==='CI Upgrade Ledger'&&d.entries.length===2&&d.entries[0].cents===12345&&d.entries[1].cents===2345&&d.entries[0].receipt.number==='CI-0001'&&d.customers.length===1&&d.customers[0].events[0].cents===5000&&d.customers[0].events[1].cents===1000&&d.nextDraft===2)?'fixture-ok':'fixture-mismatch'};tx.oncomplete=function(){db.close()}};return true})()");
        waitFor(scenario,"window.__ciResult","fixture-ok");
    }
    @Test public void seedPreviousRelease()throws Exception{
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            ready(scenario);
            js(scenario,"(function(){window.__ciResult='pending';localStorage.setItem('mezgeb_intro_seen','1');localStorage.setItem('mezgeb_signature_tour','1');var now=Date.now(),date=new Date().toISOString().slice(0,10);var r=indexedDB.open('mezgeb_local_v2');r.onerror=function(){window.__ciResult='open-error'};r.onsuccess=function(){var db=r.result;var tx=db.transaction('documents','readwrite');var s=tx.objectStore('documents');var g=s.get('main');g.onsuccess=function(){if(!g.result){tx.abort();return;}var d=g.result.value;d.business={name:'CI Upgrade Ledger',tin:'',phone:'',vatRegistered:false};d.entries=[{id:'ci-sale',type:'sale',cents:12345,category:'Product sale',pay:'Cash',note:'CI sale marker',createdAt:now,date:date,receipt:{number:'CI-0001',status:'draft'}},{id:'ci-expense',type:'expense',cents:2345,category:'Stock purchase',pay:'Cash',note:'CI expense marker',createdAt:now-1,date:date,receipt:null}];d.customers=[{id:'ci-customer',name:'CI Customer',phone:'',events:[{id:'ci-credit',type:'credit',cents:5000,note:'CI credit',createdAt:now},{id:'ci-payment',type:'payment',cents:1000,note:'CI repayment',createdAt:now}]}];d.nextDraft=2;d.updatedAt=now;s.put({key:'main',value:d});};tx.oncomplete=function(){db.close();window.__ciResult='seeded'};tx.onabort=function(){db.close();window.__ciResult='seed-error'}};return true})()");
            waitFor(scenario,"window.__ciResult","seeded");
            readFixture(scenario);
        }
    }
    @Test public void verifyPreviousOrUpgradedLedger()throws Exception{
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            ready(scenario);readFixture(scenario);
            waitFor(scenario,"String(document.body.innerText.includes('CI Upgrade Ledger')&&document.body.innerText.includes('CI sale marker'))","true");
            // Same origin, normal app routing, no test-only production JavaScript bridge.
            js(scenario,"(function(){location.assign(location.pathname.replace(/\\/$/,'')+'/dube');return true})()");
            ready(scenario);
            waitFor(scenario,"String(document.body.innerText.includes('CI Customer'))","true");
            readFixture(scenario);
        }
    }
    @Test public void verifyOfflineUpgrade()throws Exception{
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            ready(scenario);
            // A WebView can claim it is online even while emulator egress is blocked.
            // Probe a non-bundled, cache-bypassing URL and require a network rejection.
            js(scenario,"(function(){window.__ciNetwork='pending';fetch('/api/cloud?ciOfflineProbe='+Date.now(),{cache:'no-store',credentials:'omit'}).then(function(){window.__ciNetwork='reachable'},function(){window.__ciNetwork='blocked'});return true})()");
            waitFor(scenario,"window.__ciNetwork","blocked");
            readFixture(scenario);
            waitFor(scenario,"String(document.body.innerText.includes('CI Upgrade Ledger'))","true");
            assertTrue("Expected 1.1.0 bundled route",String.valueOf(js(scenario,"location.pathname")).startsWith("/__mezgeb_native__/1.1.0/"));
        }
    }

    private void readWrittenFixture(ActivityScenario<MainActivity> scenario)throws Exception{
        for(int attempt=0;attempt<30;attempt++){
        js(scenario,"(function(){window.__ciWritten='pending';var r=indexedDB.open('mezgeb_local_v2');r.onerror=function(){window.__ciWritten='open-error'};r.onsuccess=function(){var db=r.result;var tx=db.transaction('documents','readonly');var g=tx.objectStore('documents').get('main');g.onsuccess=function(){var d=g.result&&g.result.value;var a=d&&d.entries.find(function(e){return e.id==='ci-sale'}),b=d&&d.entries.find(function(e){return e.id==='ci-expense'}),c=d&&d.entries.find(function(e){return e.note==='CI offline expense'});window.__ciWritten=!!(d&&d.business.name==='CI Upgrade Ledger'&&d.entries.length===3&&a&&a.cents===12345&&a.receipt.number==='CI-0001'&&b&&b.cents===2345&&c&&c.type==='expense'&&c.cents===777&&d.nextDraft===2&&d.customers.length===1&&d.customers[0].events[0].cents===5000&&d.customers[0].events[1].cents===1000)?'retained':'not-yet'};tx.oncomplete=function(){db.close()}};return true})()");
        for(int i=0;i<20;i++){Object result=js(scenario,"window.__ciWritten");if("retained".equals(result))return;if(!"pending".equals(result))break;Thread.sleep(100);}
        Thread.sleep(250);
        }
        fail("Offline entry and prior records were not durably retained");
    }
    @Test public void recordOfflineExpense()throws Exception{
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            ready(scenario);readFixture(scenario);
            js(scenario,"(function(){document.querySelector('.action-pair button.btn.subtle').click();return true})()");
            waitFor(scenario,"String(!!document.querySelector('[aria-label=\\\"Amount in ETB\\\"]'))","true");
            js(scenario,"(function(){var a=document.querySelector('[aria-label=\\\"Amount in ETB\\\"]'),n=document.querySelector('[role=dialog] textarea');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(a,'7.77');a.dispatchEvent(new Event('input',{bubbles:true}));Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(n,'CI offline expense');n.dispatchEvent(new Event('input',{bubbles:true}));return true})()");
            js(scenario,"(function(){document.querySelector('[role=dialog] form button[type=submit]').click();return true})()");
            waitFor(scenario,"String(document.body.innerText.includes('CI offline expense'))","true");
            readWrittenFixture(scenario);
        }
    }
    @Test public void verifyOfflineExpenseRetained()throws Exception{
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            ready(scenario);readWrittenFixture(scenario);
            waitFor(scenario,"String(document.body.innerText.includes('CI offline expense'))","true");
        }
    }

    @Test public void verifySignatureExperience()throws Exception{
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            ready(scenario);readFixture(scenario);
            waitFor(scenario,"String(document.querySelectorAll('[data-testid=signature-header] button').length)","3");
            js(scenario,"document.querySelector('[data-testid=signature-header] button').click()");
            waitFor(scenario,"String(!!document.querySelector('.signature-drawer'))","true");
            waitFor(scenario,"String(document.querySelector('.signature-drawer').innerText.includes('Data & backup')&&document.querySelector('.signature-drawer').innerText.includes('My account'))","true");
            js(scenario,"window.dispatchEvent(new Event('mezgeb-back',{cancelable:true}))");
            waitFor(scenario,"String(!!document.querySelector('.signature-drawer'))","false");
            js(scenario,"document.querySelectorAll('[data-testid=signature-header] button')[1].click()");
            waitFor(scenario,"String(!!document.querySelector('.search-sheet'))","true");
            js(scenario,"(function(){var a=document.querySelector('.premium-search input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(a,'CI sale marker');a.dispatchEvent(new Event('input',{bubbles:true}));return true})()");
            waitFor(scenario,"String(document.querySelector('.search-results').innerText.includes('CI sale marker'))","true");
            js(scenario,"window.dispatchEvent(new Event('mezgeb-back',{cancelable:true}))");
            waitFor(scenario,"String(!!document.querySelector('.search-sheet'))","false");
            js(scenario,"document.querySelectorAll('[data-testid=signature-header] button')[2].click()");
            waitFor(scenario,"String(!!document.querySelector('.account-hero'))","true");
            js(scenario,"document.querySelector('a[href$=\\\"/settings\\\"]').click()");
            waitFor(scenario,"String(!!document.querySelector('.signature-settings-index'))","true");
            js(scenario,"document.querySelector('a[href$=\\\"/settings-appearance\\\"]').click()");
            waitFor(scenario,"String(!!document.querySelector('.theme-preview.dark'))","true");
            js(scenario,"document.querySelector('.theme-preview.dark').closest('button').click()");
            waitFor(scenario,"document.documentElement.dataset.theme","dark");
            js(scenario,"document.querySelector('.theme-preview.light').closest('button').click()");
            waitFor(scenario,"document.documentElement.dataset.theme","light");
            readFixture(scenario);
        }
    }
}
